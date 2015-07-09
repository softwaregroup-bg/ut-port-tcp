(function(define) {define(function(require) {
    var _ = require('lodash');
    var net = require('net');
    var bitSyntax = require('ut-bitsyntax');
    var Port = require('ut-bus/port');
    var util = require('util');
    var codec = require('ut-codec');
    var reconnect = null;

    function TcpPort() {
        Port.call(this);
        this.conn = null;
        this.server = null;
        this.conCount = 0;
        this.framePattern = null;
        this.frameBuilder = null;
        this.codec = null;
        this.config = {
            id: null,
            logLevel: '',
            type: 'tcp',
            host: '127.0.0.1',
            port: null,
            listen: false,
            ssl: false,
            format: {
                size: null,
                codec: null,
                id: null
            }
        };
    }

    util.inherits(TcpPort, Port);

    TcpPort.prototype.init = function init() {
        Port.prototype.init.apply(this, arguments);

        reconnect = this.config.ssl ? require('ut-bus/reconnect-tls') : require('ut-bus/reconnect-net');

        if (this.config.format) {
            if (this.config.format.size) {
                this.framePattern = bitSyntax.matcher('size:' + this.config.format.size + ', data:size/binary, rest/binary');
                this.frameBuilder = bitSyntax.builder('size:' + this.config.format.size + ', data:size/binary');
            }
            if (this.config.format.codec) {
                var Codec = codec.get(this.config.format.codec);
                this.codec = new Codec(this.config.format);
            }
        }
    };

    TcpPort.prototype.incConnections = function incConnections() {
        this.conCount += 1;
        if (this.conCount > 0x1FFFFFFFFFFFFF) {
            this.conCount = 1;
        }
    };

    TcpPort.prototype.start = function start(callback) {
        Port.prototype.start.apply(this, arguments);

        if (this.config.listen) {
            this.server = net.createServer(function(c) {
                this.incConnections();
                this.pipe(c, {trace:0, callbacks:{}, conId:this.conCount});
            }.bind(this));
            this.server.listen(this.config.port);
        } else {
            if (this.config.ssl) {
                reconnect(function(stream) {
                    this.incConnections();
                    this.pipe(stream, {trace:0, callbacks:{}});
                }.bind(this)).connect({
                    host: this.config.host,
                    port: this.config.port,
                    rejectUnauthorized: false
                });
            } else {
                reconnect(function(stream) {
                    this.incConnections();
                    this.pipe(stream, {trace:0, callbacks:{}});
                }.bind(this)).connect({
                    host: this.config.host,
                    port: this.config.port
                });
            }
        }
    };

    TcpPort.prototype.sendToPTBridge = function(data) {
        var keys = Object.keys(data);
        var fields = {};
        keys.forEach(function(value) {
            switch(value) {
                case 'firstName': fields['SHORT.NAME'] = data.firstName; break;
                case 'lastName': fields['NAME.1'] = data.lastName; break;
                case 'addresses':
                    fields['STREET'] = data.addresses[0].street;
                    if (data.addresses[0].city) {
                        fields['CITY.MUNICIPAL'] = data.addresses[0].city;
                    }
                    break;
                case 'sector': fields['SECTOR'] = data.sector; break;
                case 'dateOfBirth': fields['BIRTH.INCORP.DATE'] = data.dateOfBirth; break;
                case 'phones': fields['CONTACT.MOBTEL'] = data.phones[0].number; break
                case 'salutation': fields['L.LOCAL.SALUT'] = data.salutation; break
                case 'gender': fields['GENDER'] = data.gender; break;
                case 'documents':
                    fields['ALTER.ID.NO'] = data.documents[0].number;
                    fields['ALTER.ID.TYPE'] = data.documents[0].type;
                    fields['L.ID.DELIVERY'] = data.documents[0].issuer;
                    if (data.documents[0].issueDate) {
                        fields['L.ID.DATE.DELIV'] = data.documents[0].issueDate;
                    }
                    break;
                case 'language': fields['CUST.LANGUAGE'] = data.language; break;
                case 'industry': fields['INDUSTRY'] = data.industry; break;
                case 'maritalStatus': fields['MARITAL.STATUS'] = data.maritalStatus; break;
                case 'nationality': fields['NATIONALITY'] = data.nationality; break;
                case 'residence': fields['RESIDENCE'] = data.residence; break;
                case 'spouseName': fields['SP.MEM.NO'] = data.spouseName; break;
                default: break;
            }
        });
        return fields;
    };

    TcpPort.prototype.receiveFromPTBridge = function(data) {
        var obj = {};
        var formattedData = {};
        if (data.result && data.result['ret.code'] && (data.result['ret.code'] == '0' || data.result['ret.code'] == '1')) {
            if (data.result.fields && data.result.rows) {
                data.result.fields.forEach(function (field, key) {
                    obj[field] = data.result.rows[0][key];
                });
            } else {
                return data.result;
            }
            Object.keys(obj).forEach(function (key) {
                switch (key) {
                    case '@ID':
                        formattedData.recordId = obj['@ID'];
                        break;
                    case 'SHORT.NAME':
                        formattedData.firstName = _.trim(obj['SHORT.NAME']);
                        break;
                    case 'NAME.1':
                        formattedData.lastName = _.trim(obj['NAME.1']);
                        break;
                    case 'CONTACT.MOBTEL':
                        formattedData.phones = new Array();
                        formattedData.phones[0] = {
                            type: 'mobile',
                            number: obj['CONTACT.MOBTEL']
                        };
                        break;
                    case 'BIRTH.INCORP.DATE':
                        formattedData.dateOfBirth = obj['BIRTH.INCORP.DATE'];
                        break;
                    case 'ALTER.ID.NO':
                        formattedData.documents = new Array();
                        formattedData.documents[0] = {
                            type: 'passport',
                            number: obj['ALTER.ID.NO'],
                            issuer: obj['L.ID.DELIVERY'],
                            issueDate: obj['L.ID.DATE.DELIV']
                        };
                        break;
                    case 'balance': {
                        formattedData.balance = obj['balance'];
                        break;
                    }
                    case 'CUSTOMER':
                        formattedData.customerNo = obj['CUSTOMER'];
                        break;
                    case 'CURRENCY':
                        formattedData.currency = obj['CURRENCY'];
                    default:
                        break;
                }
            });
            return formattedData;
        } else {
            var fieldErrors = [];
            if (data.result.fields) {
                Object.keys(data.result.fields).forEach(function(fieldError) {
                    if (data.result.fields[fieldError].err) {
                        fieldErrors.push(fieldError + ': ' + data.result.fields[fieldError].err);
                    }
                });
            }
            var error = new Error(data.result['ret.message']);
            error.code = data.result['ret.code'];
            error.fieldErrors = fieldErrors;
            throw error;
        }
    };

    return TcpPort;

});}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

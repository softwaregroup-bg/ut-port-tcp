'use strict';
const bitSyntax = require('ut-bitsyntax');
const {readFileSync} = require('fs');
const reconnect = require('reconnect-core');

module.exports = function({utPort}) {
    return class TcpPort extends utPort {
        constructor() {
            super(...arguments);
            this.re = null;
            this.conn = null;
            this.server = null;
            this.conCount = 0;
            this.framePattern = null;
            this.frameBuilder = null;
            this.codec = null;
            this.connections = [];
        }
        get defaults() {
            return {
                id: null,
                type: 'tcp',
                host: '127.0.0.1',
                port: null,
                listen: false,
                ssl: null,
                localPort: null,
                socketTimeOut: 60000 * 10,
                maxConnections: 1000,
                connectionDropPolicy: 'oldest',
                format: {
                    size: null,
                    codec: null,
                    id: null,
                    sizeAdjust: 0
                }
            };
        }
        async init() {
            const result = await super.init(...arguments);
            this.bytesSent = this.counter && this.counter('counter', 'bs', 'Bytes sent', 300);
            this.bytesReceived = this.counter && this.counter('counter', 'br', 'Bytes received', 300);
            this.activeEncodeCount = this.counter && this.counter('gauge', 'ae', 'Active encode count');
            this.activeDecodeCount = this.counter && this.counter('gauge', 'ad', 'Active decode count');
            const client = this.config.client || (this.config.ssl ? require('tls') : require('net'));
            this._reconnect = reconnect((...args) => client.connect(...args));

            if (this.config.format) {
                this.codec = undefined;
                if (this.config.format.codec) {
                    let codecType = typeof this.config.format.codec;
                    let Codec;

                    if (codecType === 'function') {
                        Codec = this.config.format.codec;
                    } else if (codecType === 'string') {
                        throw new Error('Use format.codec:require(\'ut-codec-' + this.config.format.codec + '\') instead of ' +
                            'format.codec:\'' + this.config.format.codec + '\'');
                    }
                    if (!this.errors || !this.errors.getError) throw new Error('Please use the latest version of ut-port');
                    this.codec = new Codec(Object.assign({}, this.errors, this.config.format));
                }
                if (this.codec && (this.codec.frameReducer) && (this.codec.frameBuilder)) {
                    this.frameBuilder = this.codec.frameBuilder;
                    this.framePattern = this.codec.frameReducer;
                } else if (this.config.format.size) {
                    this.frameBuilder = bitSyntax.builder('size:' + this.config.format.size + ', data:size/binary');
                    if (this.config.format.sizeAdjust || this.config.maxReceiveBuffer) {
                        this.framePatternSize = bitSyntax.matcher('size:' + this.config.format.size + ', data/binary');
                        this.framePattern = bitSyntax.matcher('data:size/binary, rest/binary');
                    } else {
                        this.framePattern = bitSyntax.matcher('size:' + this.config.format.size + ', data:size/binary, rest/binary');
                    }
                }
            }
            this.config.maxReceiveBuffer = parseInt(this.config.maxReceiveBuffer, 10) || 0;
            !this.config.maxReceiveBuffer && this.log.warn && this.log.warn({$meta: {mtid: 'config', opcode: 'maxReceiveBuffer'}, message: 'Missing maxReceiveBuffer in configuration'});
            if (this.config.clusterIp && this.config.port && this.config.listen) {
                this.config.k8s = {
                    ports: [{
                        name: 'tcp-server',
                        service: true,
                        containerPort: this.config.port,
                        clusterIP: this.config.clusterIp
                    }]
                };
            }
            return result;
        }
        incConnections() {
            this.conCount += 1;
            if (this.conCount > 0x1FFFFFFFFFFFFF) {
                this.conCount = 1;
            }
        }
        async start() {
            this.bus && this.bus.attachHandlers(this.methods, this.config.imports, this);
            const result = await super.start(...arguments);

            let onConnection = stream => {
                this.incConnections();
                this.connections.push(stream);

                if (this.connections.length > this.config.maxConnections) {
                    this.log && this.log.warn && this.log.warn(`Connection limit exceeded (max ${this.config.maxConnections}). Closing ${this.config.connectionDropPolicy} connection.`);
                    switch (this.config.connectionDropPolicy) {
                        case 'oldest':
                            this.connections.shift().destroy();
                            break;
                        case 'newest':
                            this.connections.pop().destroy();
                            return;
                    }
                }

                stream.on('close', () => {
                    let index = this.connections.indexOf(stream);
                    if (index !== -1) {
                        this.connections.splice(index, 1);
                    }
                });

                let context = {
                    trace: 0,
                    callbacks: {},
                    created: new Date(),
                    localAddress: stream.localAddress,
                    localPort: stream.localPort,
                    remoteAddress: stream.remoteAddress,
                    remotePort: stream.remotePort
                };

                if (this.config.listen) {
                    context.conId = this.conCount;
                }

                this.pull(stream, context);
            };

            if (this.config.listen) {
                if (this.config.ssl) {
                    const opts = Object.assign({
                        requestCert: true,
                        rejectUnauthorized: true
                    }, this.config.ssl);
                    if (this.config.ssl.keyPath) {
                        opts.key = readFileSync(this.config.ssl.keyPath, 'utf8');
                    }
                    if (this.config.ssl.certPath) {
                        opts.cert = readFileSync(this.config.ssl.certPath, 'utf8');
                    }
                    if (Array.isArray(this.config.ssl.caPaths)) {
                        opts.ca = this.config.ssl.caPaths.map(file => readFileSync(file, 'utf8'));
                    }
                    this.server = require('tls').createServer(opts, onConnection);
                } else {
                    this.server = require('net').createServer(onConnection);
                }

                this.server.on('close', () => {
                    // todo
                    // notify('close', through2({objectMode: true}, nullWriter), {trace: 0, callbacks: {}});
                })
                    .on('error', err => {
                        this.log && this.log.error && this.log.error(err);
                    })
                    .listen(this.config.port);
            } else {
                let connProp;
                if (this.config.ssl) {
                    connProp = {
                        host: this.config.host,
                        port: this.config.port,
                        rejectUnauthorized: false,
                        ...this.config.connection
                    };
                } else {
                    connProp = {
                        host: this.config.host,
                        port: this.config.port,
                        ...this.config.connection
                    };
                }
                if (this.config.localPort) {
                    connProp.localPort = this.config.localPort;
                }
                this.re = this._reconnect(onConnection)
                    .on('error', (err) => {
                        this.log && this.log.error && this.log.error(err);
                    })
                    .connect(connProp);
            }
            return result;
        }
        stop() {
            if (this.re) {
                this.re.removeAllListeners();
                let e = this.re.disconnect();
                e && e._connection && e._connection.unref();
            }
            if (this.server) {
                this.server.close();
                this.server.unref();
                this.server = null;
            }
            return super.stop(...arguments);
        }
    };
};

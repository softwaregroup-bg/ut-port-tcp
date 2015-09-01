# **TCP Port:** `ut-port-tcp` #
The purpose of this port is for establishing TCP connections to remote network locations or to represent a TCP server itself.
It can be configured for standard socket communication or secured socket communication (TLS/SSL).

### **Technological Dependencies** ###

 - `when.js` - [GitHub Official Page](https://github.com/cujojs/when)
 - `ut-bitsyntax` - TODO add link to documentation
 - `ut-bus/port` - TODO add link to documentation
 - `ut-codec` - TODO add link to documentation
 - `through2` - [GitHub Official Page](https://github.com/rvagg/through2)
 - `reconnect-net` - [GitHub Official Page](https://github.com/juliangruber/reconnect-net)
 - `reconnect-tls` - [GitHub Official Page](https://github.com/fgascon/reconnect-tls)

In the UT5 implementations the TCP port is initialized in the following manner:

```javascript
    module.exports = {
        id: 't24',
        type: 'tcp',
        logLevel: 'trace',
        host: '<REMOTE_SERVER>',
        port: '<REMOTE_PORT>',
        listen: false,
        socketTimeOut: 10000,//how much time to wait without communication until closing connection, defaults to "forever"
        ssl: true,
        connRouter: function(queues) {//connection router example
            var q = Object.keys(queues);
            return q[0];
        },
        namespace: ['t24'],
        format: {
            size: '32/integer',
            codec: 'plain'
        },
        receive: function(msg) {
            return msg;
        },
        send: function(msg) {
            return msg;
        }
    }
```

It has to be saved inside the ports folder of the implementation and the full path to the module should look like this:

    /impl-<NAME>/ports/t24/index.js

In the implementation's `server.js` file the port is loaded like this:

```javascript
    module.exports = {
        ports: [
            // ...
            require('./ports/t24')
            // ...
        ],
        modules: {
            // ..
        }
    };
```

The TCP port after the execution of its `init` method from the `ut-bus` determines if it will run on normal socket or on TLS/SSL, then it initializes
its `ut-codec` to parse all in-going/out-going communications.
When its `start` method is invoked the actual server/client connection is started and it starts to listen for in-going/out-going messages.
Those messages get inside the `send` and `receive` methods, as described in the example above. The `send` represents the out-going conversion
of the port, e.g. the messages that the application has to send to the remote location (for example a T24 server) and the `receive` represents the
in-going conversion of the port, e.g. the messages coming from the remote location. The codec that is passed to the configuration of the port
represents the parser of the communication (T24, Payshield, NDC, etc.).
When working with this port it is important to keep in mind that you have to "remember" the requests and to match them to the appropriate responses
because of the asynchronicity of the port. Consider the following solution to this problem:

    var tracer = [];
    var sequence = 0;
    module.exports = {
        receive: function(msg) {
            msg.$$ = {};
            msg.$$.mtid = 'response';
            msg.$$.trace = msg.sequence;
            msg.$$.callback = tracer    [msg.sequence].callback;
            delete tracer[msg.sequence];
            return msg;
        },
        send: function(msg) {
            msg.$$.mtid = 'request';
            sequence++; msg.$$.trace = sequence;
            tracer[sequence] = {
                callback: msg.$$.callback
            };
            return msg;
        }
    }

The code from above ensures that the callback from the request to the TCP port will persist during the waiting time for the response.
In the `send` we push the callback of the request and store it by its unique sequence number. Once the response comes we check the sequence
and get the appropriate callback from the `tracer` array of callbacks.

`connRouter` method is used for connection choose, when tcp port is in listen mode lots of clients can connect, because its is hard to tell which message to whom client needs to go, we will
leave this decision into programmer's hands trough `connRouter`, detailed description follows

```javascript
connRouter: function(queues) {//queues is of type Object, it holds all connections available for use
    var q = Object.keys(queues);
    return q[0];//this method should always return the queue hash
},
```
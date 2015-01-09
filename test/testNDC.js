require('repl').start({useGlobal: true});

var wire = require('wire');

m = wire({
    bunyan: {
        create: {
            module: 'ut-log',
            args: {
                type: 'bunyan',
                name: 'bunyan_test',
                streams: [
                    {
                        level: 'trace',
                        stream: 'process.stdout'
                    }
                ]
            }
        }
    },
    atm: {
        create: 'ut-port-tcp',
        init: 'init',
        properties: {
            config: {
                id: 'atm',
                logLevel: 'trace',
                port: 5000,
                listen: true,
                format: {
                    size: '16/integer',
                    codec: 'ndc'
                }
            },
            logFactory: {$ref: 'bunyan'}
        }
    }
}, {require: require}).then(function contextLoaded(context) {
    context.atm.start();
}).done();

'use strict';
module.exports = function() {
    let conId = this.nextConId || 0;
    let count = this.config.connections.length;
    let i = count;
    while (i-- && !this.connectionMap.has((conId % count) + 1)) {
        conId++;
    }
    if (this.connectionMap.has((conId % count) + 1)) {
        this.nextConId = conId + 1;
        return (conId % count) + 1;
    } else {
        this.nextConId = 0;
        return null;
    }
};

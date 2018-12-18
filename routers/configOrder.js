'use strict';
module.exports = function() {
    for (let i = 1; i <= this.config.connections.length; i++) {
        if (this.connectionMap.has(i)) {
            return i;
        }
    }
};

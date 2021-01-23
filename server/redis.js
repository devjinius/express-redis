const Redis = require("ioredis");
let redis = {};

module.exports = {
    get: (serverName) => {
        const options = {
            host: '',
            port: ''
        };

        if (!redis[serverName]) {
            redis[serverName] = new Redis();
        }

        return redis[serverName];
    }
}

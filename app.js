const express = require('express');
const next = require('next');
const { loadGetInitialProps } = require('next/dist/next-server/lib/utils');

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const redisInit = () => {
    const subRedis = require('./server/redis').get('subRedis');
    require('./server/redis').get('pubRedis');
    const getRedis = require('./server/redis').get('getRedis');

    const followChannel = 'follow';
    const postChannel = 'post';

    subRedis.on('message', async (channel, message) => {
        if (channel === followChannel) {
            console.log('');
            console.log('==========');
            console.log('follow 채널에서 메시지가 발생했습니다. message: ', message);
            console.log('==========');
        } else if (channel === postChannel) {
            console.log('');
            console.log('@@@@@@@@@');
            console.log('postChannel 채널에서 메시지가 발생했습니다. message: ', message);
            console.log('@@@@@@@@@');

            const parsed = JSON.parse(message);
            const userId = parsed.userId;
            const postId = parsed.postId;

            try {
                const followeeList = await getRedis.zrevrange(`followee:${userId}`, 0, 10);
                for (followerId of followeeList) {
                    await getRedis.lpush(`feed:${followerId}`, postId);
                }
            } catch (error) {
                console.log(error);
            }
        }
    });


    subRedis.subscribe(followChannel, (error, count) => {
        if (error) {
            throw new Error(error);
        }
        console.log(`${followChannel} 구독을 시작합니다.`);
    });

    subRedis.subscribe(postChannel, (error, count) => {
        if (error) {
            throw new Error(error);
        }
        console.log(`${postChannel} 구독을 시작합니다.`);
    });
};

(async () => {
    const followChannel = 'follow';
    const postChannel = 'post';

    await app.prepare();

    const server = express();
    redisInit();

    server.get('/follow', (req, res) => {
        const pubRedis = require('./server/redis').get('pubRedis');
        pubRedis.publish(followChannel, "user 6번이 user 1번을 구독합니다.");

        return res.json({
            a: 'test'
        });
    });

    server.get('/followers/:id', async (req, res) => {
        const getRedis = require('./server/redis').get('getRedis');
        
        getRedis.zrevrange(`follower:${req.params.id}`, 0, 10, "WITHSCORES").then((res) => console.log(res));

        return res.json({
            b: 'test'
        });
    });

    server.get('/follow/:followerId/:score/:followeeId', async (req, res) => {
        const pubRedis = require('./server/redis').get('pubRedis');
        const follower = req.params.followerId;
        const followee = req.params.followeeId;

        try {
            await pubRedis.zadd(`follower:${follower}`, req.params.score, followee);
            await pubRedis.zadd(`followee:${followee}`, req.params.score, follower);
            await pubRedis.publish(followChannel, `user ${follower}가 user ${followee}를 follow 합니다.`);
        } catch (error) {
            return res.json({ error });
        }
        
        return res.json({ status: 'ok' });
    });

    server.get('/followers/:id', (req, res) => {
        return res.json({
            b: 'test'
        });
    });

    const random = ['rolemlipsumsldf;jvnxz', 'lsdjflsajkfolisjeflwnf,sm', 'testtsetsetsetste', 'sdfjaosjvio1o210982uejq23r9128'];
    server.get('/post/:userId/:postId', async (req, res) => {
        const index = Math.floor(Math.random() * 4);

        const pubRedis = require('./server/redis').get('pubRedis');
        const userId = req.params.userId;
        const postId = req.params.postId;

        try {
            await pubRedis.hmset(`post:${req.params.userId}`, { [postId]: random[index] });
            await pubRedis.publish(postChannel, JSON.stringify({ userId, postId }));
        } catch (error) {
            console.log(error);
        }

        return res.json({ status: 'ok' });
    });

    server.get('/feed/:userId', async (req, res) => {
        const userId = req.params.userId;
        const getRedis = require('./server/redis').get('getRedis');

        try {
            const feedList = await getRedis.lrange(`feed:${userId}`, 0, -1);    
            return res.json({ feedList });
        } catch (error) {
            console.log(error);
        }

        return res.json({ });
    });

    server.all('*', (req, res) => {
        return handle(req, res);
    });

    server.listen(port, (err) => {
        if (err) throw err
        console.log(`> Ready on http://localhost:${port}`);
    });
})();
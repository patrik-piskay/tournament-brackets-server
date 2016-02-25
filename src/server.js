import express from 'express';
import bodyParser from 'body-parser';
import cors from 'express-cors';

import routes from './routes';

const app = express();

app.use(bodyParser.json());
app.use(cors({
    allowedOrigins: [
        'localhost',
        'localhost:8080'
    ]
}));

routes.register(app);

const server = app.listen(3000, function() {
    const port = server.address().port;

    console.log('Tournament brackets server listening at port', port);
});
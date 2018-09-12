require('dotenv').config();
var Botkit = require('botkit');

const rp = require('request-promise');

if (!process.env.CLIENT_ID || !process.env.CLIENT_SECRET || !process.env.PORT || !process.env.VERIFICATION_TOKEN) {
    console.log('Error: Specify CLIENT_ID, CLIENT_SECRET, VERIFICATION_TOKEN and PORT in environment');
    process.exit(1);
}

// By default, Botkit will use json-file-store to keep data in JSON files in the filesystem.
// (Note this will not work on hosting systems that do not let node applications write to the file system.)
// MONGO_URI for example:'mongodb://test:test@ds037145.mongolab.com:37145/slack-bot-test'
let config = {};
if (process.env.MONGO_URI) {
    var BotkitStorage = require('botkit-storage-mongo');
    config = {
        storage: BotkitStorage({ mongoUri: process.env.MONGO_URI} ),
    };
} else {
    config = {
        json_file_store: './db_coinbot/',
    };
}

var controller = Botkit.slackbot(config).configureSlackApp({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    scopes: ['commands'],
});

controller.setupWebserver(process.env.PORT, function (err, webserver) {
    controller.createWebhookEndpoints(controller.webserver);

    controller.createOauthEndpoints(controller.webserver, function (err, req, res) {
        if (err) {
            res.status(500).send('ERROR: ' + err);
        } else {
            res.send('Success!');
        }
    });
});

controller.on('slash_command', function (slashCommand, message) {

    switch (message.command) {
        case "/coinbot": 
            if (message.token !== process.env.VERIFICATION_TOKEN) return;

            // help command
            if (message.text === "" || message.text === "help") {
                slashCommand.replyPrivate(message,
                    "Try typing /coinbot _cryptocurrency-symbol_ TO _fiat-symbol_, for example" + 
                    "`/coinbot BTC` or `/coinbot ETH to EUR` (default fiat currency is USD).");
                return;
            }

            const delim = ['TO', 'IN'];
            var params = message.text.toUpperCase().split(new RegExp(delim.join('|'), 'g'));
            
            var cryptoSymbol = params[0].trim();
            var convert = params.length === 2 ? params[1].trim() : 'USD';
            
            const requestOptions = {
                method: 'GET',
                uri: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
                qs: {
                    symbol: cryptoSymbol,
                    convert: convert
                },
                headers: {
                    'X-CMC_PRO_API_KEY': process.env.COIN_MARKET_CAP_API_KEY
                },
                json: true,
                gzip: true
            };

            rp(requestOptions).then(response => {
                var name = response.data[cryptoSymbol].name;
                var quote = response.data[cryptoSymbol].quote[convert];

                const resMessage = '>>> *1 ' + name + '* is worth *' + parseFloat(quote.price).toFixed(2) + ' ' + convert + '*';

                slashCommand.replyPrivate(message, resMessage);
            }).catch((err) => {
                console.log('API call error:', err.message);
            });

            break;
        default:
            slashCommand.replyPrivate(message, message.command + " is not a supported command.");
    }
});

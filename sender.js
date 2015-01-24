//nodejs sender.js steamMachineAuth123123123123123=sdfgsdfgsdfgsdfg username password false steamidtotradewith [captcha]

var steamGame = 570;
var itemName = 'Arc of the Northern Wind';

var totalTrades = 0;
var tradesMin = 0;
var tradesPrevMin = 0;
var tradeStart = 0;
var args = process.argv;
var trading = false;
var reciever = false;
var fs = require('fs');

var tradeAccount = args[6];//Bot will trade with this user and trust it
var turn = args[5] == "true" ? true : false;

var logOnOptions = {
    accountName: args[3],
    password: args[4]
};

var authCode =
    args[7];

if (fs.existsSync('sentry' + logOnOptions.accountName)) {
    logOnOptions['shaSentryfile'] = require('fs').readFileSync('sentry' + logOnOptions.accountName);
} else if (authCode != '') {
    logOnOptions['authCode'] = authCode;
}

var Steam = require('steam');
var SteamTrade = require('steam-trade');
var steam = new Steam.SteamClient();
var steamTrade = new SteamTrade();

steamTrade.setCookie(args[2]);
steam.logOn(logOnOptions);

steam.on('debug', console.log);
steam.on('loggedOn', function (result) {
    console.log('Logged in as ' + logOnOptions.accountName);
    steam.setPersonaState(Steam.EPersonaState.Online);
});

steam.on('sentry', function (sentryHash) {
    console.log("writing sentry file");
    fs.writeFile('sentry' + logOnOptions.accountName, sentryHash, function (err) {
        if (err) {
            console.log(err);
        } else {
            console.log('Saved sentry file hash as "sentry"');
        }
    });
});

setInterval(function () {
    tradesPrevMin = tradesMin;
    console.log("Trades per minute: " + tradesMin)
    console.log("Trades total: " + totalTrades);
    tradesMin = 0;
}, 60000);

setInterval(function () {
    if (tradeStart != 0 && (Math.floor(Date.now() / 1000) - tradeStart > 45)) { //Just to make sure something doesn't go wrong
        console.log("TIMEOUT, something went wrong.");
        console.log("Canceling trade!");
        steamTrade.cancel();
        if (turn) {
            steam.trade(tradeAccount);
        }
    }
}, 5000);

steam.on('webSessionID', function (sessionID) {
    console.log('Session ID:', sessionID);
    steamTrade.sessionID = sessionID;
    steam.webLogOn(function (cookies) {
        console.log('Cookies:', cookies);
        cookies.forEach(function (cookie) {
            steamTrade.setCookie(cookie);
        });

        if (turn) {
            console.log("Sending trade to " + tradeAccount);
            steam.trade(tradeAccount);
        }
    });
});

var inventory;
var client;

steam.on('tradeProposed', function (tradeID, otherClient) {
    steam.respondToTrade(tradeID, true);
});

steam.on('sessionStart', function (otherClient) {
    inventory = [];
    client = otherClient;

    if (trading) {
        console.log("already in a trade... out of sync....");
        steamTrade.cancel();
        trading = false;
        if (turn) {
            steam.trade(tradeAccount);
        }
        return false;
    }
    trading = true;
    reciever = true; //Both bots start as reciever

    console.log('Trading with ' + steam.users[client].playerName);

    tradeStart = Math.floor(Date.now() / 1000);

    if (client != tradeAccount) {
        steamTrade.cancel();
        console.log("Not allowed to trade with..");
        return false;
    }
    steamTrade.open(otherClient);

    steamTrade.loadInventory(steamGame, 2, function (inv) {
        inventory = inv;
        if (typeof inv === 'undefined') {
            console.log("Failed to load inventory")
            return false;
        }
        var item = inv.filter(function (item) {
            return item.name == itemName;
        });
        if (item.length) { //If bot has item, add it to trade
            reciever = false;
            console.log('Adding ' + itemName);
            steamTrade.addItem(item[0]);
        }
    });
});

steamTrade.on('offerChanged', function (added, item) {
    console.log('they ' + (added ? 'added ' : 'removed ') + item.name);
    steamTrade.chatMsg("trade");
});

steamTrade.on('end', function (result) {
    if (result != "timeout") {
        console.log("Trade " + result + ", took: " + (Math.floor(Date.now() / 1000) - tradeStart));

        totalTrades++;
        tradesMin++;
        trading = false;
    } else {
        console.log("trade error");
    }
    if (reciever) { //Reciever bot will ALWAYS send invite because it will most likely get out of sync.
        console.log("Sending trade to " + tradeAccount);
        steam.trade(tradeAccount);
    }
});

steamTrade.on('ready', function () {
    steamTrade.ready(function () {
        steamTrade.confirm();
    });
});

steamTrade.on('chatMsg', function (msg) {

    if (msg == 'trade' && client == tradeAccount) {
        steamTrade.ready(function () {
            steamTrade.confirm();
        });
    }
});

steam.on('error', function (e) {
    console.log('Error');
    if (e.eresult == Steam.EResult.InvalidPassword) {
        console.log('Wrong PW/User');
    }else if (e.eresult == Steam.EResult.AccountLogonDenied) {
        console.log('Steam Guard needed, restart');
    }
})
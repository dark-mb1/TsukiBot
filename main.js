/* --------------------------------------------------------------------

                   _____          _    _ ____        _
                  |_   ____ _   _| | _(_| __ )  ___ | |_
                    | |/ __| | | | |/ | |  _ \ / _ \| __|
                    | |\__ | |_| |   <| | |_) | (_) | |_
                    |_||___/\__,_|_|\_|_|____/ \___/ \__|



 * Author:      Logan "EthyMoney"
 * Base:        Forked from "TsukiBot", written by Oscar "Cehhiro"
 * Program:     TsukiBot

 * Discord bot that offers a wide range of services
 * related to cryptocurrencies and server management.

 * No parameters on start, except -d for dev mode.

 * If you like this service, consider donating
 * ETH to my address: 0x169381506870283cbABC52034E4ECc123f3FAD02 

 * ------------------------------------------------------------------- */

/* global parseFloat */  //Suppress console parseFloat errors

// Example usage of connection string:  postgres://userName:password@serverName/ip:port/nameOfDatabase
// Be sure to run the GetCoins.js script before starting the bot. This is necessary to populate the known coins index.

// -------------------------------------------
// -------------------------------------------
//
//           SETUP AND DECLARATIONS
//
// -------------------------------------------
// -------------------------------------------

// File read for JSON and PostgreSQL
const fs                = require('fs');
const pg                = require('pg');
const pgp               = require('pg-promise');

// Scheduler
const schedule          = require('node-schedule');

// Set the prefix
const prefix            = ['-t', '.tb', '-T', '.TB', '.Tb', '.tB'];

// Current CMC API key
let cmcKey              = 1; 

// Files allowed
const extensions        = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'mov', 'mp4'];

// Allowed coins in commands
let pairs		        = JSON.parse(fs.readFileSync("./common/coins.json","utf8"));
let pairs_filtered      = JSON.parse(fs.readFileSync("./common/coins_filtered.json","utf8"));
let pairs_CG            = JSON.parse(fs.readFileSync("./common/coinsCG.json","utf8"));

// Tags
let tagsJSON            = JSON.parse(fs.readFileSync("tags.json", "utf8"));

// Metadata for all coins
let metadata            = JSON.parse(fs.readFileSync("./common/metadata.json","utf8"));

// Banned words
const restricted        = JSON.parse(fs.readFileSync("./common/bannedWords.json","utf8"));

// Coin request counter initialization
let requestCounter      = {};
pairs.forEach(p         => requestCounter[p] = 0);

// Coin mention counter initialization
let mentionCounter      = {};
let msgAcc              = "";
const MESSAGE_LIMIT     = 100000;
pairs_filtered.forEach(p => mentionCounter[p] = 0);

// Help string
let title 		        = '__**TsukiBot**__ :full_moon: \n';
const github		    = 'Check the GitHub repo for more detailed information. <https://github.com/YoloSwagDogDiggity/TsukiBot>';
const helpjson          = JSON.parse(fs.readFileSync('./common/help.json','utf8'));

// Discord Bots List
const DBL               = require("dblapi.js");
let dbl;                //will be initialized upon startup

// HTTP and websocket request
const request           = require("request");
const WebSocket         = require('ws');

// Get the api keys
let keys                = JSON.parse(fs.readFileSync('./common/keys.api','utf8'));

// Get the admin commands
const admin             = JSON.parse(fs.readFileSync('./common/admin.json','utf8'));

// Include API things
const Discord 		    = require('discord.js');
const api 		        = require('etherscan-api').init(keys['etherscan']);
const cc 		        = require('cryptocompare');
const CoinMarketCap     = require('coinmarketcap-api');
const ccxt              = require('ccxt-js');
const graviex           = require("graviex");
const CoinGecko         = require('coingecko-api');

// Import web3
const Web3              = require('web3');

// STEX API client setup
const stex              = require('stocks-exchange-client'),
                        option = {
                          api_key:keys['stex'],
                          api_secret:keys['stexSecret']
                        },
stexClient              = new stex.client(option);

// Include fancy console outputs
const chalk             = require('chalk');

// Graviex key insertion
graviex.accessKey       = keys['graviexAccessKey'];    
graviex.secretKey       = keys['graviexSecretKey'];

// CMC Cache
let cmcArray            = {};
let cmcArrayDict        = {};
let cmcArrayDictParsed  = [];
let fails               = 0;
let auto                = true;
let selectedKey         = 0;

// Spam limit count
let yeetLimit           = 0;

// Translation log
let getEmCoach          = false;

// Spellcheck
const didyoumean        = require("didyoumean");

// Google translate
const translateSimple   = require('translate-google');
const {Translate}       = require('@google-cloud/translate');
const translate         = new Translate();

// CryptoCompare requires global fetch
global.fetch            = require('node-fetch');

// JS DOM Selections
const jsdom             = require("jsdom");
const { JSDOM }         = jsdom;

// Declare channels and message counter
let channelName         = 'general';
let messageCount        = 0;
let referenceTime       = Date.now();

// Permissions configurations
let configIDs           = [];
let serverConfigs       = {};
const availableCommands = ['prices','mc','trans','delet','pa','join','done'];
const emojiConfigs      = [
  ":chart_with_upwards_trend: ",
  "💰",
  ":page_facing_up:",
  ":octagonal_sign:",
  ":signal_strength:",
  "📧",
  "✅"
];

// Shortcut config
let shortcutConfig        = JSON.parse(fs.readFileSync("./common/shortcuts.json","utf8"));

// Alpha Vantage API
let Alpha                 = require('alpha_vantage_api_wrapper').Alpha;
let alpha                 = new Alpha(keys['alpha']);

// Initialize api things
const clientKraken        = new ccxt.kraken();
const bitmex              = new ccxt.bitmex();
const CoinGeckoClient     = new CoinGecko();
const clientPoloniex      = new ccxt.poloniex();
const clientBinance       = new ccxt.binance();
const clientBittrex       = new ccxt.bittrex();
const clientBitfinex      = new ccxt.bitfinex2();
const clientCoinbase      = new ccxt.coinbasepro();
let clientcmc;            //Will be initialized upon bot bootup

// Reload Coins
const reloader            = require('./getCoins');
const reloaderCG          = require('./getCoinsCG');

// Scheduled Actions
 //let deleter      = schedule.scheduleJob('*/5 * * * *', checkSubStatus);
 //let mentionLog   = schedule.scheduleJob('*/5 * * * *', checkMentions);
let cmcfetch      = schedule.scheduleJob('*/5 * * * *', getCMCData);
let yeetReset     = schedule.scheduleJob('*/2 * * * *', resetSpamLimit);
let updateList    = schedule.scheduleJob('0 12 * * *', updateCoins);
let updateCMCKey  = schedule.scheduleJob('1 */1 * * *', updateCmcKey);

const donationAdd         = "0x169381506870283cbABC52034E4ECc123f3FAD02";
const quote               = 'Enjoying TsukiBot? Consider supporting its creator:';
const inviteLink          = 'https://discordapp.com/oauth2/authorize?client_id=506918730790600704&scope=bot&permissions=268823664';

// -------------------------------------------
// -------------------------------------------
//
//             UTILITY FUNCTIONS
//
// -------------------------------------------
// -------------------------------------------


/* --------------------------------------------

    These methods are calls on the api of the
    respective exchanges and other services
    for price checks and so much more.
    These methods are the core funcionality
    of the bot. Command calls will usually end
    in one of these.

  -------------------------------------------- */


//------------------------------------------
//------------------------------------------

// Function that gets Coinbase Pro prices

async function getPriceCoinbase(chn, coin1, coin2){

    let fail = false;
    let tickerJSON = '';
    if (typeof coin2 === 'undefined') {
        coin2 = 'BTC';
    }
    if (coin2.toLowerCase() === 'usd' || coin1.toLowerCase() === 'btc'){
        coin2 = 'USD';
    }
    tickerJSON = await clientCoinbase.fetchTicker(coin1.toUpperCase() + '/' + coin2.toUpperCase()).catch(function (rej) {
        console.log(chalk.red.bold('Coinbase error: Ticker '
            + chalk.cyan(coin1.toUpperCase() + '/' + coin2.toUpperCase()) + ' not found!'));
        chn.send('API Error:  Coinbase does not have market symbol __' + coin1.toUpperCase() + '/' + coin2.toUpperCase() + '__');
        fail = true;
    });
    if (fail) {
        //exit the function if ticker didn't exist, or api failed to respond
        return;
    }
    //console.log(tickerJSON);
    let s = parseFloat(tickerJSON['last']).toFixed(8);
    console.log(chalk.green('Coinbase API ticker response: ' + chalk.cyan(s)));
    let c = tickerJSON['info'].priceChangePercent;
    c = Math.round(c * 100) / 100;

    let ans = '__Coinbase__ Price for **' + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `' + s + ' ' + coin2.toUpperCase() + '` .';// + '(' + '`' + c + '%' + '`' + ')' + '.';
    chn.send(ans);
}

//------------------------------------------
//------------------------------------------

// Function for grabbing prices from Graviex

async function getPriceGraviex(chn, coin1, coin2){
    console.log("Graviex Called!");
    let graviexJSON;
    let price = 0;
    let change = 0;
    let volume = 0;
    let volumeCoin = 0;
    if (typeof coin2 === 'undefined') {
        coin2 = 'BTC';
    }
    if (coin2.toLowerCase() === 'usd' || coin1.toLowerCase() === 'btc'){
        coin2 = 'USDT';
    }
    coin1 = coin1 + '';
    coin2 = coin2 + '';
    
    await graviex.ticker(coin1.toLowerCase() + coin2.toLowerCase(), function(res){
        let moon = "";
        graviexJSON = res;
        if(typeof graviexJSON.ticker === 'undefined'){
            chn.send("Internal error. Requested pair does not exist or Graviex is overloaded.");
            console.log((chalk.red("Graviex error : graviex failed to respond.")));
            return;
        }
        price = graviexJSON.ticker.last;
        console.log(chalk.green("Graviex API ticker response: " + chalk.cyan(price)));
        change = graviexJSON.ticker.change;
        change = parseFloat(change * 100).toFixed(2);
        volume = graviexJSON.ticker.volbtc;
        volumeCoin = graviexJSON.ticker.vol;
        
        if(change > 20){moon = ":full_moon_with_face:";};
        
        let ans = '__Graviex__ Price for **'  + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `'  + price + ' ' + coin2.toUpperCase() +  '` ' + '(' + '`' + change + '%' + '`' + ') ' + moon;
        
        if(coin2.toLowerCase() === 'btc'){
            ans = ans + '\n//// **24hr volume **➪ `' + parseFloat(volume).toFixed(4) + ' ' + coin2.toUpperCase() + '` ' + '➪ `' + numberWithCommas(parseFloat(volumeCoin).toFixed(0)) + ' ' + coin1.toUpperCase() + '`';
        }
        chn.send(ans);
    });
}

//------------------------------------------
//------------------------------------------

// Function for grabbing prices from STEX

async function getPriceSTEX(chn, coin1, coin2){
  //default to usdt if none is provided
  if (typeof coin2 === 'undefined') {
      coin2 = 'BTC';
  }
  if (coin2.toLowerCase() === 'usd' || coin1.toLowerCase() === 'btc'){
      coin2 = 'USDT';
  }
  let tickerJSON = '';
  let fail = false;
  let yesterday = 0;
  let last = 0;
  let s = 0;
  
  //grab last traded price and make sure requested pair is valid
  await stexClient.tradeHistoryPub(coin1.toUpperCase() + "_" + coin2.toUpperCase(), function (res) {
    tickerJSON = JSON.parse(res);
    if(tickerJSON.success === 0 || typeof tickerJSON.success === 'undefined'){ fail = true;}
    
    //exit the function if ticker didn't exist or api failed to respond
    if(fail){
    chn.send('API Error:  STEX does not have market symbol __' + coin1.toUpperCase() + '/' + coin2.toUpperCase() + '__');
    return;
    }
    s = tickerJSON.result[0].price;
  
  //grab 24hr data
  stexClient.ticker(function (res) {
    let tickerStexSummary = JSON.parse(res);
    for(var i = 0, len = tickerStexSummary.length; i < len; i++) {
      if(tickerStexSummary[i].market_name === (coin1.toUpperCase() + "_" + coin2.toUpperCase())){
          last = tickerStexSummary[i].last;
          yesterday = tickerStexSummary[i].lastDayAgo;
          break;
      }
    }
    console.log (chalk.green('STEX API ticker response: '+ chalk.cyan(s)));
    
    //calculate % change from day-old price
    let c = (last-yesterday);
    c = c / yesterday * 100;
    c = Math.round(c * 100) / 100;
    let ans = '__STEX__ Price for **' + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `' + s + ' ' + coin2.toUpperCase() + '` ' + '(' + '`' + c + '%' + '`' + ')' + '.';
    chn.send(ans);
  });
  });
}

//------------------------------------------
//------------------------------------------

// Function for grabbing price from CoinGecko

async function getPriceCoinGecko(coin, coin2, chn) {
  coin = coin.toLowerCase() + "";
  //default to usd if no comparison is provided
  if(typeof coin2 === 'undefined'){
      coin2 = 'usd';
  }
  coin2 = coin2.toLowerCase() + "";
  if (!coin2.includes('usd') && !coin2.includes('btc') && !coin2.includes('eur')){
      coin2 = 'usd';
  }
  //find out the ID for coin requested
  let found = false;
  let coinID = "";
  for (let i = 0, len = pairs_CG.length; i < len; i++) {
    if(pairs_CG[i].symbol === coin){
        coinID = pairs_CG[i].id;
        found = true;
        break;
    }
  }
  if(found){
  let data = await CoinGeckoClient.simple.price( {
    ids: [coinID],
    vs_currencies: ['usd', 'btc', 'eur'],
    include_24hr_vol : [true],
    include_24hr_change : [true]
    }); 
    
  let s = parseFloat(data["data"][coinID][coin2]).toFixed(8);
  let c = Math.round(data["data"][coinID][coin2.toLowerCase() + "_24h_change"] * 100) / 100;
  
  chn.send("__CoinGecko__ Price for **" + coin.toUpperCase() + "-" + coin2.toUpperCase() + "** is: `" + s + " " + coin2.toUpperCase() + "` (`" + c + "%`).");
  console.log(chalk.green('CoinGecko API ticker response: ' + chalk.cyan(s)));
  }
  else{
      chn.send("Ticker **" + coin + "** not found!");
  }
};

//------------------------------------------
//------------------------------------------

// Function that gets CMC prices

function getPriceCMC(coins, chn, action = '-', ext = 'd'){
  if(!cmcArrayDict['BTC']) return;
  //console.log(cmcArrayDict['BTC']['quote']);

  let msgh = '__CoinMarketCap__ Price for:\n';
  let msg  = '';
  let flag = false;

  let bpchg = parseFloat(cmcArrayDict['BTC']['quote']['USD']['percent_change_24h']);
  for(let i = 0; i < coins.length; i++){
    if(!cmcArrayDict[coins[i].toUpperCase()]){
      let g = didyoumean(coins[i].toUpperCase(), Object.keys(cmcArrayDict));
      if(!g)
        continue;
      else
        coins[i] = g;
    }
    let ep = parseFloat(convertToETHPrice(cmcArrayDict[coins[i].toUpperCase()]['quote']['USD']['price'])).toFixed(8) + ' ETH`';
    let bp = parseFloat(convertToBTCPrice(cmcArrayDict[coins[i].toUpperCase()]['quote']['USD']['price'])).toFixed(8) + ' BTC`';
    let up = parseFloat(cmcArrayDict[coins[i].toUpperCase()]['quote']['USD']['price']).toFixed(6) + ' USD` (`' +
      Math.round(parseFloat(cmcArrayDict[coins[i].toUpperCase()]['quote']['USD']['percent_change_24h'])*100)/100 + '%`)';

    coins[i] = (coins[i].length > 6) ? coins[i].substring(0,6) : coins[i];
    switch(action){
      case '-':
        msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' + (ext === 's' ? bp : up) + '\n');
        break;

      case '+':
        msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' +
          up + ' `⇒` `' + 
          bp + "\n");
        break;

      case '*':
        msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒ 💵` `' +
          up + '\n`|        ⇒` `' + 
          bp + "\n");
        break;
        
      case 'e':
        msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' +
          up + ' `⇒` `' + 
          ep + "\n");
        break;

      default:
        msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' + (ext === 's' ? bp : up) + '\n');
        break;
        }
  }
  
  if(action === '%'){
        flag = true;
            //Use CC for ordered percent change
            getPriceCC(coins, chn, action, ext);
      }

  msg += (Math.random() > 0.9995) ? "\n`" + quote + " " + donationAdd + "`" : "";
  if(msg !== '' && flag === false)
    chn.send(msgh + msg);
}

//------------------------------------------
//------------------------------------------

// Function that gets CryptoCompare prices

function getPriceCC(coins, chn, action = '-', ext = 'd'){
  
  let query = coins.concat(['BTC']);

  // Get the spot price of the pair and send it to general
  cc.priceFull(query.map(function(c){return c.toUpperCase();}),['USD', 'BTC'])
    .then(prices => {
      let msg = '__CryptoCompare/CMC__ Price for:\n';
      let ordered = {};

      let bpchg = parseFloat(cmcArrayDict['BTC']['percent_change_24h']);

      for(let i = 0; i < coins.length; i++){
        let bp, up;
        
        try{
          bp = prices[coins[i].toUpperCase()]['BTC']['PRICE'].toFixed(8) + ' BTC` (`' +
            Math.round(prices[coins[i].toUpperCase()]['BTC']['CHANGEPCT24HOUR']*100)/100 + '%`)';
          up = parseFloat(prices[coins[i].toUpperCase()]['USD']['PRICE']).toFixed(6) + ' USD` (`' +
            Math.round((prices[coins[i].toUpperCase()]['BTC']['CHANGEPCT24HOUR'] + prices['BTC']['USD']['CHANGEPCT24HOUR'])*100)/100 + '%`)';
        } catch(e) {
          if(cmcArrayDict[coins[i].toUpperCase()]){
            bp = convertToBTCPrice(parseFloat(cmcArrayDict[coins[i].toUpperCase()]['quote']['USD']['price'])) + ' BTC` (`' +
              Math.round(parseFloat(cmcArrayDict[coins[i].toUpperCase()]["quote"]["USD"]["percent_change_24h"] - bpchg)*100)/100 + '%`)';
            up = parseFloat(cmcArrayDict[coins[i].toUpperCase()]['quote']['USD']['price']).toFixed(6) + ' USD` (`' +
              Math.round(parseFloat(cmcArrayDict[coins[i].toUpperCase()]["quote"]["USD"]["percent_change_24h"])*100)/100 + '%`)';
          } else {
            bp = 'unvavilable`';
            up = 'unavailable`';
          }
        }

        coins[i] = (coins[i].length > 6) ? coins[i].substring(0,6) : coins[i];
        switch(action){
          case '-':
            msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' + (ext === 's' ? bp : up) + '\n');
            break;

          case '%':
            try {
              ordered[prices[coins[i].toUpperCase()]['BTC']['CHANGEPCT24HOUR'] + prices['BTC']['USD']['CHANGEPCT24HOUR']] = 
                ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' + (ext === 's' ? bp : up) + '\n');
            } catch(e) {
              if(cmcArrayDict[coins[i].toUpperCase()])
                ordered[cmcArrayDict[coins[i].toUpperCase()]["quote"]["USD"]["percent_change_24h"]] = 
                  ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' + (ext === 's' ? bp : up) + '\n');
            }
            break;

          case '+':
            msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' +
              up + ' `⇒` `' + 
              bp + "\n");
            break;

          case '*':
            msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒ 💵` `' +
              up + '\n`|        ⇒` `' + 
              bp + "\n");
            break;

          default:
            msg += ("`• " + coins[i].toUpperCase() + ' '.repeat(6-coins[i].length) + ' ⇒` `' + (ext === 's' ? bp : up) + '\n');
            break;
        }
      }

      if(action === '%'){
        let k = Object.keys(ordered).sort(function(a,b){ return parseFloat(b) - parseFloat(a); });
        for(let k0 in k)
          msg += ordered[k[k0]];
      }
      chn.send(msg);
    })
    .catch(console.log);
}


//------------------------------------------
//------------------------------------------

// Function that gets Bitfinex prices

async function getPriceBitfinex(coin1, coin2, chn){

    let fail = false;
    let tickerJSON = '';
    if (typeof coin2 === 'undefined') {
        coin2 = 'BTC';
    }
    if (coin2.toLowerCase() === 'usd' || coin1.toLowerCase() === 'btc'){
        coin2 = 'USDT';
    }
    tickerJSON = await clientBitfinex.fetchTicker(coin1.toUpperCase() + '/' + coin2.toUpperCase()).catch(function (rej) {
        console.log(chalk.red.bold('Bitfinex error: Ticker '
            + chalk.cyan(coin1.toUpperCase() + '/' + coin2.toUpperCase()) + ' not found!'));
        chn.send('API Error:  Bitfinex does not have market symbol __' + coin1.toUpperCase() + '/' + coin2.toUpperCase() + '__');
        fail = true;
    });
    if (fail) {
        //exit the function if ticker didn't exist, or api failed to respond
        return;
    }
    //console.log(tickerJSON);
    let s = parseFloat(tickerJSON['last']).toFixed(6);
    if (coin2.toUpperCase() === 'BTC'){
        s = parseFloat(tickerJSON['last']).toFixed(8);
    }
    console.log(chalk.green('Bitfinex API ticker response: ' + chalk.cyan(s)));
    let c = tickerJSON['percentage'] * 100;
    c = Math.round(c * 100) / 100;

    if(coin2.toUpperCase() === 'USDT'){
        coin2 = 'USD';
    }
    
    let ans = '__Bitfinex__ Price for **' + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `' + s + ' ' + coin2.toUpperCase() + '` ' + '(' + '`' + c + '%' + '`' + ')' + '.';
    chn.send(ans);
}


//------------------------------------------
//------------------------------------------


// Function that gets Kraken prices

async function getPriceKraken(coin1, coin2, chn) {
    
    let fail = false;
    let tickerJSON = '';
    if (typeof coin2 === 'undefined') {
        coin2 = 'BTC';
    }
    if (coin2.toLowerCase() === 'usd' || coin1.toLowerCase() === 'btc'){
        coin2 = 'USD';
    }
    tickerJSON = await clientKraken.fetchTicker(coin1.toUpperCase() + '/' + coin2.toUpperCase()).catch(function (rej) {
        console.log(chalk.red.bold('Kraken error: Ticker '
            + chalk.cyan(coin1.toUpperCase() + '/' + coin2.toUpperCase()) + ' not found!'));
        chn.send('API Error:  Kraken does not have market symbol __' + coin1.toUpperCase() + '/' + coin2.toUpperCase() + '__');
        fail = true;
    });
    if (fail) {
        //exit the function if ticker didn't exist, or api failed to respond
        return;
    }
    let s = tickerJSON['last'];
    console.log(chalk.green('Kraken API ticker response: ' + chalk.cyan(s)));
    // Calculate % change from daily opening
    let c = tickerJSON['info'].o - s;
    c = (c / tickerJSON['info'].o) * 100;
    c = Math.round(c * 100) / 100;
    c = c * -1;

    let ans = '__Kraken__ Price for **' + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `' + s + ' ' + coin2.toUpperCase() + '` ' + '(' + '`' + c + '%' + '`' + ')' + '.';
    chn.send(ans);
}


//------------------------------------------
//------------------------------------------


// Function that gets Bitmex prices

async function getPriceMex(coin1, err, chn){
  
  let s = '';
  let c = '';
  let coin2 = 'btc';
  let tickerJSON = '';
  let today = new Date();
  let dd = String(today.getDate()).padStart(2, '0');
  let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
  let yy = today.getFullYear() - 2000;
  let m = '';
  let done = false;
  //console.log(mm + "::" + dd + ":::" + yy);
 
  // Figure out current contract code
  if ((mm <= 12 && (mm >= 1 && mm <= 3)) && !done) {if((mm === 3 && dd >= 28)){m = 'M'; done=true;} else{m = 'H'; done=true;}}
  if (mm >= 3 && mm <= 6 && !done) {if((mm === 6 && dd >= 28)){m = 'U'; done=true;} else{m = 'M'; done=true;}}
  if (mm >= 6 && mm <= 9 && !done) {if((mm === 9 && dd >= 28)){m = 'Z'; done=true;} else{m = 'U'; done=true;}}
  if (mm >= 9 && mm <= 12 && !done) {if((mm === 12 && dd >= 28)){m = 'H';} else{m = 'Z';}}
  let contractCode = m + yy;
  //console.log(chalk.blue(contractCode));
  
  // This implementation changes as the BitMEX contract period code changes every 3 months
  switch(coin1.toUpperCase()) {
    case 'BTC':
        tickerJSON = await bitmex.fetchTicker('BTC/USD');
        coin2 = 'usd';
        break;
    case 'ETH':
        tickerJSON = await bitmex.fetchTicker('ETH/USD');
        coin2 = 'usd';
        break;
    case 'BCH':
        tickerJSON = await bitmex.fetchTicker('BCH' + contractCode);
        break;
    case 'EOS':
        tickerJSON = await bitmex.fetchTicker('EOS' + contractCode);
        break;
    case 'ADA':
        tickerJSON = await bitmex.fetchTicker('ADA' + contractCode);
        break;
    case 'LTC':
        tickerJSON = await bitmex.fetchTicker('LTC' + contractCode);
        break;
    case 'TRX':
        tickerJSON = await bitmex.fetchTicker('TRX' + contractCode);
        break
    case 'XRP':
        tickerJSON = await bitmex.fetchTicker('XRP' + contractCode);
        break
    default:
        chn.send('BitMEX Error: `Ticker "' + err.toUpperCase() + '" not found.`');
        return;
    } 
  
    s = tickerJSON['last'];
    console.log (chalk.green('BitMEX REST API ticker response: '+ chalk.cyan(s)));
    c = tickerJSON['percentage'];
    c = Math.round(c * 100) / 100;

    let ans = '__BitMEX__ Price for **'  + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `'  + s + ' ' + coin2.toUpperCase() +  '` ' + '(' + '`' + c + '%' + '`' + ')' + '.';
    chn.send(ans);
}


//------------------------------------------
//------------------------------------------


// Function that gets Poloniex prices

async function getPricePolo(coin1, coin2, chn){

    let fail = false;
    let tickerJSON = '';
    if (typeof coin2 === 'undefined') {
        coin2 = 'BTC';
    }
    if (coin2.toLowerCase() === 'usd' || coin1.toLowerCase() === 'btc'){
        coin2 = 'USDT';
    }
    tickerJSON = await clientPoloniex.fetchTicker(coin1.toUpperCase() + '/' + coin2.toUpperCase()).catch(function (rej) {
        console.log(chalk.red.bold('Poloniex error: Ticker '
            + chalk.cyan(coin1.toUpperCase() + '/' + coin2.toUpperCase()) + ' not found!'));
        chn.send('API Error:  Poloniex does not have market symbol __' + coin1.toUpperCase() + '/' + coin2.toUpperCase() + '__');
        fail = true;
    });
    if (fail) {
        //exit the function if ticker didn't exist, or api failed to respond
        return;
    }
    let s = parseFloat(tickerJSON['last']).toFixed(8);
    console.log(chalk.green('Poloniex API ticker response: ' + chalk.cyan(s)));
    let c = tickerJSON['info'].percentChange * 100;
    c = Math.round(c * 100) / 100;

    let ans = '__Poloniex__ Price for **' + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `' + s + ' ' + coin2.toUpperCase() + '` ' + '(' + '`' + c + '%' + '`' + ')' + '.';
    chn.send(ans);
}


//------------------------------------------
//------------------------------------------

//Binance Function

async function getPriceBinance(coin1, coin2, chn){

    let fail = false;
    let tickerJSON = '';
    if (typeof coin2 === 'undefined') {
        coin2 = 'BTC';
    }
    if (coin2.toLowerCase() === 'usd' || coin1.toLowerCase() === 'btc'){
        coin2 = 'USDT';
    }
    tickerJSON = await clientBinance.fetchTicker(coin1.toUpperCase() + '/' + coin2.toUpperCase()).catch(function (rej) {
        console.log(chalk.red.bold('Binance error: Ticker '
            + chalk.cyan(coin1.toUpperCase() + '/' + coin2.toUpperCase()) + ' not found!'));
        chn.send('API Error:  Binance does not have market symbol __' + coin1.toUpperCase() + '/' + coin2.toUpperCase() + '__');
        fail = true;
    });
    if (fail) {
        //exit the function if ticker didn't exist, or api failed to respond
        return;
    }
    let s = parseFloat(tickerJSON['last']).toFixed(8);
    console.log(chalk.green('Binance API ticker response: ' + chalk.cyan(s)));
    let c = tickerJSON['info'].priceChangePercent;
    c = Math.round(c * 100) / 100;

    let ans = '__Binance__ Price for **' + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `' + s + ' ' + coin2.toUpperCase() + '` ' + '(' + '`' + c + '%' + '`' + ')' + '.';
    chn.send(ans);
}


//------------------------------------------
//------------------------------------------

// Bittrex Function

async function getPriceBittrex(coin1, coin2, chn){

    let fail = false;
    let tickerJSON = '';
    if (typeof coin2 === 'undefined') {
        coin2 = 'BTC';
    }
    if (coin2.toLowerCase() === 'usd' || coin1.toLowerCase() === 'btc'){
        coin2 = 'USDT';
    }
    tickerJSON = await clientBittrex.fetchTicker(coin1.toUpperCase() + '/' + coin2.toUpperCase()).catch(function (rej) {
        console.log(chalk.red.bold('Bittrex error: Ticker '
            + chalk.cyan(coin1.toUpperCase() + '/' + coin2.toUpperCase()) + ' not found!'));
        chn.send('API Error:  Bittrex does not have market symbol __' + coin1.toUpperCase() + '/' + coin2.toUpperCase() + '__');
        fail = true;
    });
    if (fail) {
        //exit the function if ticker didn't exist, or api failed to respond
        return;
    }
    let s = parseFloat(tickerJSON['last']).toFixed(8);
    console.log(chalk.green('Bittrex API ticker response: ' + chalk.cyan(s)));
    let c = tickerJSON['percentage'];
    c = Math.round(c * 100) / 100;

    let ans = '__Bittrex__ Price for **' + coin1.toUpperCase() + '-' + coin2.toUpperCase() + '** is: `' + s + ' ' + coin2.toUpperCase() + '` ' + '(' + '`' + c + '%' + '`' + ')' + '.';
    chn.send(ans);
}


//------------------------------------------
//------------------------------------------

// This function grabs price data for traditional markets via Alpha Vantage
async function getStocksAlpha(coin1, chn, usr){
    let price = '';
    let vol = '';
    let change = '';
    
    let alphaJSON = await alpha.stocks.quote(coin1);
    
    let quote = JSON.stringify(alphaJSON["Global Quote"]);
    if(!quote || 2 === quote.length) {
        chn.send("API Error: Ticker **" + coin1.toUpperCase() + "** not found.");
        return;
    }
    //console.log(alphaJSON);
    price = alphaJSON["Global Quote"]["05. price"];
    vol = alphaJSON["Global Quote"]["06. volume"];
    change = alphaJSON["Global Quote"]["10. change percent"];
    
    console.log(chalk.green('Alpha Vantage API ticker response: ' + chalk.cyan(price) + " by: ") + chalk.yellow(usr.username));
    
    chn.send("Market price for **$" + coin1.toUpperCase() + "** is: `" + price + "` (`" + parseFloat(change).toFixed(2) + "%`).");
}


//------------------------------------------
//------------------------------------------

// Grabs coin purpose and description data from CMC
async function getCoinDescription(coin1, chn, usr){
    //check if coin exists on cmc
    if(cmcArrayDict[coin1.toUpperCase()]){
    console.log(chalk.green("Coin description requested by " + chalk.yellow(usr.username) + " for " + chalk.cyan(coin1.toUpperCase())));
    //grab coin name and build url
    let name = cmcArrayDict[coin1.toUpperCase()].slug;
    let logo = '';
    let url = 'https://coinmarketcap.com/currencies/' + name + '/';
    let html = '';
    let text = '';
    
    for (let j = 0, len = metadata.data.length; j < len; j++) {
      if(metadata.data[j].coin === coin1.toUpperCase()){
        if(metadata.data[j].logo){
            logo = metadata.data[j].logo;
        } else{
           // default to cmc logo
           logo = 'https://is3-ssl.mzstatic.com/image/thumb/Purple118/v4/8e/5b/b4/8e5bb4b3-c3a4-2ce0-a48c-d6b614eda574/AppIcon-1x_' + 
             'U007emarketing-0-0-GLES2_U002c0-512MB-sRGB-0-0-0-85-220-0-0-0-6.png/246x0w.jpg';
        }
        if(metadata.data[j].description){
            text = metadata.data[j].description;
            break;
        } else{
            chn.send("**Error:** CMC does not yet have a description for __" + coin1.toUpperCase() + "__");
            console.log(chalk.red("No CMC desc found for " + chalk.cyan(coin1.toUpperCase())));
            return;
        }
      } 
    }
        let embed = new Discord.RichEmbed()
          .addField("About " + capitalizeFirstLetter(name) + ":", text)
          .setColor('#1b51be')
          .setThumbnail(logo)
          .setFooter('Source: CoinMarketCap', 'https://is3-ssl.mzstatic.com/image/thumb/Purple118/v4/8e/5b/b4/8e5bb4b3-c3a4-2ce0-a48c-d6b614eda574/AppIcon-1x_' + 
                'U007emarketing-0-0-GLES2_U002c0-512MB-sRGB-0-0-0-85-220-0-0-0-6.png/246x0w.jpg');

        chn.send({embed}).catch(function(rej){
          channel.send("Sorry, I was unable to process this command. Make sure that I have full send permissions for embeds and messages and then try again!");
          console.log(chalk.red('Error sending coin info response: ' + chalk.cyan(rej)));
        });
    
    }
    else{
        chn.send("**Error:** __" + coin1.toUpperCase() + "__ is not a valid coin on CMC.");
    }   
}



//------------------------------------------
//------------------------------------------

// Function that retrieves the current fear/greed index value
async function getFearGreedIndex(chn, usr) {
    request('https://api.alternative.me/fng/?limit=1&format=json', function (error, response, body) {
        let color = '';
        //parse response data
        let resJSON = JSON.parse(body);
        //calculate embed color based on value
        if(resJSON.data[0].value >= 40 && resJSON.data[0].value <= 60){color = '#f2f207';}
        else{
          if(resJSON.data[0].value > 60){color = '#0eed11';}
            else{color = '#ea0215';}
        }
        //calculate next update countdown
        let d = resJSON.data[0].time_until_update;
        let h = Math.floor(d / 3600);
        let m = Math.floor(d % 3600 / 60);
        //create embed and insert data 
        let embed = new Discord.RichEmbed()
                .setAuthor("Fear/Greed Index", 'https://en.bitcoin.it/w/images/en/2/29/BC_Logo_.png')
                .addField("Current Value:", resJSON.data[0].value + " (" + resJSON.data[0].value_classification + ")")
                .setColor(color)
                .setFooter("Next update: " + h + " hrs, " + m + " mins");

        chn.send({embed}).catch(function (rej) {
          channel.send("Sorry, I was unable to process this command. Make sure that I have full send permissions for embeds and messages and then try again!");
          console.log(chalk.red('Error sending fear/greed index! : ' + chalk.cyan(rej)));
        });
    });

}



//------------------------------------------
//------------------------------------------

// Function for grabbing Bitmex swap contract funding data
async function getMexFunding(chn, message){
  let messageNumber = 0;
  //create websocket listener
  const ws = new WebSocket('wss://www.bitmex.com/realtime?subscribe=instrument,orderBook:XBTUSD', {
    perMessageDeflate: false
  });
 
  ws.on('message', function incoming(data) {
    messageNumber++;
    if(messageNumber === 4){
        let btc = '';
        let eth = '';
        
        //find the btc and eth objects
        let dataJSON = JSON.parse(data).data;
        for(let i=0; i< dataJSON.length; i++){
            if(dataJSON[i].symbol === 'XBTUSD'){
                btc = dataJSON[i];
            }
            if(dataJSON[i].symbol === 'ETHUSD'){
                eth = dataJSON[i];
            }
        }
        
        let text = 'Current Rate: `' + parseFloat(btc.fundingRate*100).toFixed(4) + "%` \n" +
                   'Predicted Rate: `' + parseFloat(btc.indicativeFundingRate*100).toFixed(4) + '%`';
        let text2 = 'Current Rate: `' + parseFloat(eth.fundingRate*100).toFixed(4) + "%` \n" +
                   'Predicted Rate: `' + parseFloat(eth.indicativeFundingRate*100).toFixed(4) + '%`';
           
        let embed = new Discord.RichEmbed()
          .setAuthor("BitMEX Perpetual Swap Contract Funding Stats")
          .addField("XBT/USD:", text)
          .addField("ETH/USD:", text2)
          .setThumbnail('https://firebounty.com/image/751-bitmex')
          .setColor('#1b51be')
          .setFooter("BitMEX Real-Time", 'https://firebounty.com/image/751-bitmex')

        chn.send({embed}).catch(function(rej){
          channel.send("Sorry, I was unable to process this command. Make sure that I have full send permissions for embeds and messages and then try again!");
          console.log(chalk.red('Error sending bitmex funding! : ' + chalk.cyan(rej)));
        });
    }
  });
}



//------------------------------------------
//------------------------------------------

// Grabs the current data for Bitmex long and short positions
async function getMexLongsShorts(channel) {

  //grab the html
  request('https://blockchainwhispers.com/bitmex-position-calculator/', function (error, response, body) {
    //after collecting the html, pull out the data and send it
    const dom = new JSDOM(body);

    //BTC data
    let block = dom.window.document.getElementsByClassName('col-md-4');
    // 0 is finex, 1 is mex, 2 is total in the block array
    let title = block[1].querySelector('h3').textContent;
    let longs = block[1].querySelector('div.single-margin-platform div.field-value span.value.long').textContent.trim().split(" ")[0].trim();
    let longsPercent = block[1].querySelector('div.single-margin-platform div.field-value span.value.long small').textContent;
    let shorts = block[1].querySelector('div.single-margin-platform div.field-value span.value.short').textContent.trim().split(" ")[0].trim();
    let shortsPercent = block[1].querySelector('div.single-margin-platform div.field-value span.value.short small').textContent;

    let embed = new Discord.RichEmbed()
      .setAuthor(title, 'https://en.bitcoin.it/w/images/en/2/29/BC_Logo_.png')
      .addField('Longs:', longs + " (" + longsPercent + ")")
      .addField('Shorts:', shorts + " (" + shortsPercent + ")")
      .setThumbnail('https://firebounty.com/image/751-bitmex')
      .setColor('#1b51be')
      .setFooter('BlockchainWhispers Real-Time', 'https://pbs.twimg.com/profile_images/1050791280886861826/6ui6Ugt1_400x400.jpg');

    channel.send({embed}).catch(function (rej) {
      channel.send("Sorry, I was unable to process this command. Make sure that I have full send permissions for embeds and messages and then try again!");
      console.log(chalk.red('Error sending longs/shorts! : ' + chalk.cyan(rej)));
    });
  });
}




//------------------------------------------
//------------------------------------------

//Fuction that converts Binance currencies into other Binance currencies

    async function convertPriceBinance(chn, coin1, coin2, numCoin2){

        let fail = false;
        let tickerJSON = '';
        coin3 = 'BTC';
        coin4 = 'BTC';
        coin1_backup = coin1;
        coin2_backup = coin2;
        if (typeof coin2 === 'undefined') {
            coin2 = 'BTC';
        }
        if (coin2.toLowerCase() === 'usd'){
            coin4 = 'USDT';
            coin2 = 'BTC';
        }
        if (coin1.toLowerCase() === 'usd'){
            coin3 = 'USDT';
            coin1 = 'BTC';
        }
        if (coin1.toLowerCase() === 'btc' && coin3.toLowerCase() != 'usdt'){
            coin3 = 'BTC';
            coin1 = 'ETH';
        }
        if (coin2.toLowerCase() === 'btc' && coin4.toLowerCase() != 'usdt'){
            coin4 = 'BTC';
            coin2 = 'ETH';
        }


        tickerJSON = await clientBinance.fetchTicker(coin1.toUpperCase() + '/' + coin3).catch(function (rej) {
            console.log(chalk.red.bold('Binance error: Ticker '
                + chalk.cyan(coin1.toUpperCase()) + ' not found!'));
            chn.send('API Error:  Binance does not have market symbol __' + coin1.toUpperCase() + '/' + coin3.toUpperCase() + '__');
            fail = true;
        });

        let s1 = parseFloat(tickerJSON['last']).toFixed(8);
        console.log(chalk.green('Binance API ticker response: ' + chalk.cyan(s1)));

        if (coin3.toLowerCase() === 'usdt') {
            s1 = 1 / s1;
        }
        if (coin1_backup.toLowerCase() === 'btc') {
            s1 = 1;
        }

        tickerJSON = await clientBinance.fetchTicker(coin2.toUpperCase() + '/' + coin4).catch(function (rej) {
            console.log(chalk.red.bold('Binance error: Ticker '
                + chalk.cyan(coin1.toUpperCase()) + ' not found!'));
            chn.send('API Error:  Binance does not have market symbol __' + coin1.toUpperCase() + '/' + coin4.toUpperCase() + '__');
            fail = true;
        });

        let s2 = parseFloat(tickerJSON['last']).toFixed(8);
        console.log(chalk.green('Binance API ticker response: ' + chalk.cyan(s2)));

        if (coin4.toLowerCase() === 'usdt') {
            s2 = 1 / s2;
        }
        if (coin2_backup.toLowerCase() === 'btc') {
            s2 = 1;
        }


        if (fail) {
            //exit the function if ticker didn't exist, or api failed to respond
            return;
        }

        convResult = (s2 / s1) * numCoin2;
        let ansi = numberWithCommas(numCoin2) + ' ' + coin2_backup.toUpperCase() + ' is equal to **' +
            numberWithCommas(convResult.toFixed(2)) +
            ' ' + coin1_backup.toUpperCase() + '** at the current Binance rate of **' +
            numberWithCommas((s1 / s2).toFixed(2)) + ' '
            + coin2_backup.toUpperCase() + ' per ' + coin1_backup.toUpperCase() + '.**';

        chn.send(ansi);
    }




//------------------------------------------
//------------------------------------------

// Tags handler function
function tagsEngine(channel, author, timestamp, guild, command, tagName, tagLink) {
  
  let valid = false;
  let validTag = false;
  let name = null;
  let tag = null;
  let resultName = null;
  let resultTag = null;
  let resultAuthorName = null;
  let resultAuthorAvatar = null;
  let resultTimestamp = null;
  let tagList = [];

  if (command && tagName && tagLink && validURL(tagLink)) {
    name = tagName.toString().toLowerCase();
    tag = tagLink;
    valid = true;
  }

  if (tagName && !validURL(tagName)) {
    validTag = true;
  }

  if (command === 'createtag' && valid) {
    //load current tags cache and set checkup flag
    let obj = tagsJSON;
    let tags = tagsJSON.tags;
    let fail = false;

    //collision detection for creating tags that already exist
    for (let i = 0; i < tags.length; i++) {
        if (tags[i].guild === guild.id && !fail) {
            if (name === tags[i].tagName.toLowerCase()) {
                channel.send("That tag already exists! Use a different name and try again.");
                fail = true;
            }
        }
    }

    if(!fail) {
        //proceed to create the new tag upon all checks succeeding
        obj.tags.push({
            guild: guild.id,
            authorName: author.username,
            authorAvatar: author.avatarURL,
            timestamp: timestamp,
            tagName: name,
            tagLink: tag
        }); //add a fresh tag
        let json = JSON.stringify(obj); //convert it back to json
        fs.writeFile('tags.json', json, 'utf8', function (err) {
            if (err) {
                console.log(chalk.red("ERROR: " + err));
            } else {
                tagsJSON = JSON.parse(fs.readFileSync("tags.json", "utf8")); //read and reload the tags cache
            }
        }); //write it back
        console.log(chalk.blue("Tag " + "\"" + tagName + "\"" + " created!"));
        channel.send("Tag " + "\"" + tagName + "\"" + " created!");
    }

  } else if (command === 'deletetag' && validTag) {
    let tags = tagsJSON.tags;
    for (let i = 0; i < tags.length; i++) {
      if (tags[i].guild === guild.id) {
        if (tagName.toString().toLowerCase() === tags[i].tagName) {
          resultName = tags[i].tagName;
          tags.splice(i, 1);
          tagsJSON.tags = tags;
          let json = JSON.stringify(tagsJSON); //convert it back to json
          fs.writeFile('tags.json', json, 'utf8', function (err) {
            if (err) {
              console.log(chalk.red("ERROR: " + err));
            } else {
              tagsJSON = JSON.parse(fs.readFileSync("tags.json", "utf8")); //read and reload the tags cache
            }
          }); //write it back 
          channel.send("Tag " + "\"" + resultName + "\"" + " deleted.");
          console.log(chalk.blue("Tag " + "\"" + tagName + "\"" + " deleted!"));
          return;
        }
      }
    }

  } else if (command === 'taglist') {
      let tags = tagsJSON.tags;
      let found = false;
      for (let i = 0; i < tags.length; i++) {
          if (tags && (tags[i].guild === guild.id)) {
                  tagList.push(tags[i].tagName);
                  found = true;
          }
      }
      if(!found){
          channel.send("There are no tags in this server! Feel free to make one using `.tb createtag <tag name here> <tag link here>`");
      }
      else{
          let msg = '';
          tagList.forEach(function(item, index, array) {
              msg += item + ", ";
          });
          let embed = new Discord.RichEmbed()
              .setAuthor("Tsuki Tags", 'http://happybirthdayworld.net/wp-content/uploads/2018/05/filthy-frank-happy-birthday-1.jpg')
              .addField("Available tags in this server: ", msg.substring(0, msg.length-2))
              .setColor('#1b51be')
              .setFooter("To see a tag, use  .tb tag <tag name here>");

          channel.send({embed}).catch(function (rej) {
            channel.send("Sorry, I was unable to process this command. Make sure that I have full send permissions for embeds and messages and then try again!");
            console.log(chalk.red('Error sending taglist! : ' + chalk.cyan(rej)));
          });
      }

  } else if (command === 'tag' && validTag) {
    let tags = tagsJSON.tags;
    for (let i = 0; i < tags.length; i++) {
      if (tags[i].guild === guild.id) {
        if (tagName.toString().toLowerCase() === tags[i].tagName) {
          resultAuthorAvatar = tags[i].authorAvatar;
          resultAuthorName = tags[i].authorName;
          resultName = tags[i].tagName;
          resultTag = tags[i].tagLink;
          resultTimestamp = tags[i].timestamp;
          break;
        }
      }
    }

    if (null === resultName) {
      channel.send("That tag doesn't exist!");
      return;
    }

    let embed = new Discord.RichEmbed()
          .setAuthor("Tsuki Tags", 'http://happybirthdayworld.net/wp-content/uploads/2018/05/filthy-frank-happy-birthday-1.jpg')          .addField("Tag: \"" + resultName + "\"", resultTag)
          .setImage(resultTag)
          .setColor('#1b51be')
          .setTimestamp(resultTimestamp)
          .setFooter(resultAuthorName, resultAuthorAvatar);

      channel.send({embed}).catch(function (rej) {
        channel.send("Sorry, I was unable to process this command. Make sure that I have full send permissions for embeds and messages and then try again!");
        console.log(chalk.red('Error sending tag! : ' + chalk.cyan(rej)));
      });

  } else {
    channel.send("Incorrect use of tags command! Here's how to use tags: <coming soon>");
    return;
  }

}



//------------------------------------------
//------------------------------------------

// From the etherscan api, get the balance
// for a given address. The balance is returned
// in weis.

function getEtherBalance(address, chn, action = 'b'){
  if(action === 'b'){
    let balance = api.account.balance(address);
    balance.then(function(res){
      chn.send('The total ether registered for `' + address + '` is: `' + res['result'] / 1000000000000000000 + ' ETH`.');
    });
  } else {
    let block = api.proxy.eth_blockNumber();
    let tx = api.proxy.eth_getTransactionByHash(address);

    tx.then(function(res){
      if(res.result !== null) {
        if(res.result.blockNumber !== null) {
          block.then(function(blockres){
            chn.send('Transaction included in block `' + Web3.utils.hexToNumber(res.result.blockNumber) + '`.' + 
              (blockres.result ? ' Confirmations: `' + (1 + Web3.utils.hexToNumber(blockres.result) - Web3.utils.hexToNumber(res.result.blockNumber)) + '`': ''));
          }).catch(() => {
            chn.send('Transaction included in block `' + Web3.utils.hexToNumber(res.result.blockNumber) + '`.');
          });
        } else {
          chn.send('Transaction still not mined.');
        }
      } else {
        chn.send('Transaction not found. (Neither mined nor broadcasted.)');
      }
    });
  }
}


//------------------------------------------
//------------------------------------------

// Function for getting total market cap data and BTC dominance

function getMarketCap(message){
  (async () => {
    console.log(chalk.yellow(message.author.username) + chalk.green(" requested global market cap data"));
    //gathering info and setting variables
    let global_market = await clientcmc.getGlobal();
    //console.log(global_market['data']['quote']);
    let mcap = numberWithCommas(global_market['data']['quote']['USD']["total_market_cap"]);
    let btcdom = global_market['data']["btc_dominance"];
    //console.log(chalk.green("mcap: " + chalk.cyan(mcap)));
    message.channel.send("**[all]** `$" + mcap + "` BTC dominance: `" + (Math.round(btcdom * 100) / 100) + "%`");
  }) ();
}


//------------------------------------------
//------------------------------------------

// Function for getting market cap data of a specific coin

function getMarketCapSpecific(message){
  let cursor = 1;
  //collect the data
  let cur = '';
  if(message.content.includes('.tb')){
      cur = message.content.replace('.tb ', '').split(" ")[1].toUpperCase();
  }
  else{
      cur = message.content.replace('-t ', '').split(" ")[1].toUpperCase();
  }
  if(cur === 'HAMMER'){message.channel.send('https://youtu.be/otCpCn0l4Wo?t=14'); return;}
  (async () => {
    console.log(chalk.yellow(message.author.username) + chalk.green(" requested MC of: " + chalk.cyan(cur)));
    let ticker = cmcArrayDictParsed;
    j = ticker.length;
    for (let i = 0; i < j; i++) {
      if (ticker[i]["symbol"] === cur || ticker[i]["name"].toUpperCase() === cur || ticker[i]["cmc_rank"]+'' === cur) {
      let name = ticker[i]["name"];
      let price = parseFloat(ticker[i]["quote"]["USD"]["price"]).toFixed(6);
      let priceBTC = convertToBTCPrice(price).toFixed(8);
      let percent = ticker[i]["quote"]["USD"]["percent_change_24h"];
      let rank = ticker[i]["cmc_rank"];
      let percent7 = ticker[i]["quote"]["USD"]["percent_change_7d"];
      let symbol = ticker[i]["symbol"];
      let volume = ticker[i]["quote"]["USD"]["volume_24h"];
      let marketcap = parseInt(ticker[i]["quote"]["USD"]["market_cap"]);
      let supply = parseInt(ticker[i]["circulating_supply"]);
      let totalSupply = ticker[i]["total_supply"];
      let maxSupply = ticker[i]["max_supply"];
      let percent1h = ticker[i]["quote"]["USD"]["percent_change_1h"];
      
      //check for missing data and process values
      if(!supply){supply = "n/a";}             else{supply = numberWithCommas(supply);}
      if(!totalSupply){totalSupply = "n/a";}   else{totalSupply = numberWithCommas(parseFloat(totalSupply).toFixed(0));}
      if(!maxSupply){maxSupply = "n/a";}       else{maxSupply = numberWithCommas(parseFloat(maxSupply).toFixed(0));}
      if(!volume){volume = "n/a";}             else{volume = numberWithCommas(parseFloat(volume).toFixed(2));}
      if(!percent1h){percent = "n/a";}         else{percent1h = parseFloat(percent1h).toFixed(2);}
      if(!percent){percent = "n/a";}           else{percent = parseFloat(percent).toFixed(2);}
      if(!percent7){percent7 = "n/a";}         else{percent7 = parseFloat(percent7).toFixed(2);}
      
      //verbose logging toggle
      const verbose = false;
      if(verbose){
      console.log(chalk.green("Rank: ") + chalk.cyan(rank));
      console.log(chalk.green("Name: " + chalk.cyan(name)));
      console.log(chalk.green("Price: " + chalk.cyan(price)));
      console.log(chalk.green("24hr Change: ") + chalk.cyan(percent));
      console.log(chalk.green("7d Change: ") + chalk.cyan(percent7));
      }

      let logo = 'https://is3-ssl.mzstatic.com/image/thumb/Purple118/v4/8e/5b/b4/8e5bb4b3-c3a4-2ce0-a48c-d6b614eda574/AppIcon-1x_' +
          'U007emarketing-0-0-GLES2_U002c0-512MB-sRGB-0-0-0-85-220-0-0-0-6.png/246x0w.jpg';
      for (let j = 0, len = metadata.data.length; j < len; j++) {
          if(metadata.data[j].coin === symbol.toUpperCase()) {
              if (metadata.data[j].logo) {
                  logo = metadata.data[j].logo;
              }
          }
      }
    
      let l1 = "MC Rank: #" + rank + "\n";
      let l2 = "Market Cap: " + numberWithCommas(marketcap) + " USD" + "\n";
      let l3 = "24hr Volume: " + volume + " USD" + "\n";
      let l4 = "Circulating Supply: " + supply + " " + symbol + "\n";
      let l5 = "Total Supply: " + totalSupply + " " + symbol + "\n";
      let l6 = '';
      if(maxSupply === 'n/a'){
        l6 = "Maximum Supply: " + maxSupply + "\n";
      } else{
        l6 = "Maximum Supply: " + maxSupply + " " + symbol + "\n";
      }
      let l7 = "USD: `" + price + "`\n" + "BTC: `" + priceBTC + "`\n" + "ETH: `" + convertToETHPrice(price).toFixed(6) + "`";
      let l8 = "*1h:* `" + percent1h + "%` " + "\n" + "*24h:* `" + percent + "%`" + " \n" + "*7d:* `" + percent7 + "%`";
      
      let embed = new Discord.RichEmbed()
        .addField("Market Data for " + name + " (" + symbol + ")", l1+l2+l3+l4+l5+l6, false)
        .addField("Current Prices:", l7, true)
        .addField("Price Changes:", l8, true)
        .setColor('#1b51be')
        .setThumbnail(logo)
        .setFooter('Powered by CoinMarketCap API', 'https://is3-ssl.mzstatic.com/image/thumb/Purple118/v4/8e/5b/b4/8e5bb4b3-c3a4-2ce0-a48c-d6b614eda574/AppIcon-1x_' +
              'U007emarketing-0-0-GLES2_U002c0-512MB-sRGB-0-0-0-85-220-0-0-0-6.png/246x0w.jpg');


      message.channel.send({embed}).catch(function(rej){
        channel.send("Sorry, I was unable to process this command. Make sure that I have full send permissions for embeds and messages and then try again!");
        console.log(chalk.red('Error sending MC response embed: ' + chalk.cyan(rej)));
      });
      }
      cursor++;
    }
  }) ();
}


//------------------------------------------
//------------------------------------------

// This is a setup for users to create
// their own arrays of coins. They can check
// the price from their array by typing .tbpa
// as a shortcut.

function getCoinArray(id, chn, msg, coins = '', action = ''){
  const conString = "postgres://bigboi:" + keys['tsukibot'] + "@localhost:5432/tsukibot";

  if(action === '') 
    coins = '{' + coins + '}';

  let conn = new pg.Client(conString);
  conn.connect();

  let query;
  
  //delete .tbpa command after 5 min
  //msg.delete(300000);

  // .tbpa call
  if(coins === ''){
      //chn.send("tbpa temporarily disabled during database migration, check back later!");
    query = conn.query("SELECT * FROM tsukibot.profiles where id = $1;", [id], (err, res) => {
      if (err){chalk.red.bold((err + "------TBPA query select error"));}
      else {
          //Check if current user array is empty or not and exit if it is
        if(res.rows[0] && res.rows[0].coins.replace(/\s+/g, '') !== '{}' && res.rows[0].coins.replace(/\s+/g, '') !== '{,}'){
            //Collect and store the string of coins
            let inStr = res.rows[0].coins;
            //Process coins string
            inStr = inStr.replace(/\s+/g, ''); //remove spaces
            try{
            console.log(chalk.green(
            "tbpa called by " + chalk.yellow(msg.member.user.tag) + " : " +
            chalk.blue.bold(inStr)
            ));
            } catch(err){
                console.log(chalk.red.bold('Tbpa caller ' + chalk.yellow(msg.author) + ' is null, could not get user tag. '
                + '(likely due to them being very new to server or lacking roles)'));
            }
            inStr = inStr.replace(/\{+/g, ''); //remove left bracket
            inStr = inStr.replace(/\}+/g, ''); //remove right bracket
            //Convert processed string to array of coins, then filter the array
            let coins = inStr.split(',').filter(function(value){
            return !isNaN(value) || pairs.indexOf(value.toUpperCase()) > -1; 
          });
          
          getPriceCMC(coins, chn, action);
        } else {
          chn.send('Set your array with `.tb pa [array]`. Example usage: `.tb pa btc eth xrp.....`');
        }
      }
      conn.end();
    });
        
        
    // .tb pa call
  } else { 
    if(action === '') {
      query = conn.query(("INSERT INTO tsukibot.profiles(id, coins) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET coins = $2;"), [ id, coins.toLowerCase() ], (err, res) => {
        if (err){ chalk.red.bold((err + "------TB PA query insert error")); }
        else { chn.send("Personal array set: `" + coins.toLowerCase() + "` for <@" + id + ">."); }

        conn.end();
      });
      
      
    } else {
      const command     = (action === '-') ? 'REMOVE' : 'ADD';
      query = conn.query("SELECT * FROM tsukibot.profiles where id = $1;", [id], (err, res) => {
      if (err){console.log(chalk.red.bold(err + "------TB PA query select error"));}
      else {
        let inStr = '';
        if(res.rows[0]){
            console.log(chalk.green('tbpa modification (' + chalk.cyan(command) + ' started of raw array: ' + chalk.cyan(res.rows[0].coins.replace(/\s+/g, ''))));
            //Collect and store the string of coins
            inStr = res.rows[0].coins + '';    //load the array
            inStr = inStr.replace(/\s+/g, ''); //remove spaces
            inStr = inStr.replace(/\{+/g, ''); //remove left bracket
            inStr = inStr.replace(/\}+/g, ''); //remove right bracket
            
        }if(command === 'REMOVE'){
          if (typeof inStr === 'undefined'){
              chn.send('There\'s nothing to remove, remove action aborted.');
              console.log(chalk.red.bold('Remove action aborted on null tbpa. Request was sent by: ' + chalk.yellow(msg.author.username)));
          }
          else{
          //String processing
          coins = coins.toString().toLowerCase();
          let coinsArray = coins.split(',');
          let arrayLength = coinsArray.length;
          for (let i = 0; i < arrayLength; i++) {
          //Remove each coin that was marked for deletion
          inStr = inStr.toLowerCase().replace(coinsArray[i], '');}
          //Cleanup
          while(inStr.includes(',,')){inStr = inStr.replace(',,', ',');} //remove excess commas  
          inStr = '{' + inStr + '}';
          inStr = inStr.replace('{,', '{'); //remove starting commas
          inStr = inStr.replace(',}', '}'); //remove ending commas
          inStr = inStr.replace('{,}', '{}'); //remove lingering commas
          inStr = inStr.replace(/\{+/g, ''); //remove left bracket
          inStr = inStr.replace(/\}+/g, ''); //remove right bracket
               query = conn.query(("INSERT INTO tsukibot.profiles(id, coins) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET coins = $2;"), [ id, '{' + inStr + '}' ], (err, res) => {
                    if (err){ console.log(chalk.red.bold(err + "------TB PA remove insert query error")); }
                    else { chn.send("Personal array modified."); }
        conn.end();
                        });
                    }
                }
        if(command === 'ADD'){
          //Check if user has an entry in the DB
          if (typeof inStr === 'undefined'){
            chn.send('There is no tbpa entry found for your profile, create one by using the command `.tb pa (coins here)` Example: `.tb pa btc eth xrp gnt .....`');
            console.log(chalk.red.bold('TBPA add action aborted on null tbpa. The user does not have a DB entry yet! Request was sent by: ' + chalk.yellow(msg.author.username)));
          }else{
          //String processing
          while(inStr.includes(',,')){inStr = inStr.replace(',,', ',');} //remove excess commas
          inStr = inStr + ',' + coins.toString().toLowerCase(); //add selected coins
          inStr = '{' + inStr + '}';
          inStr = inStr.replace('{,', '{'); //remove starting comma
          inStr = inStr.replace(/\{+/g, ''); //remove left bracket
          inStr = inStr.replace(/\}+/g, ''); //remove right bracket
               query = conn.query(("INSERT INTO tsukibot.profiles(id, coins) VALUES($1,$2) ON CONFLICT(id) DO UPDATE SET coins = $2;"), [ id, '{' + inStr + '}' ], (err, res) => {
                    if (err){ console.log(chalk.red.bold(err + "------TB PA add insert query error")); }
                    else { chn.send("Personal array modified."); }

        conn.end();

                        });
                    }
                }
            }
            });
        }
    }
}


//------------------------------------------
//------------------------------------------

// Service to self-service roles via commands in chat.
// This method currently handles the 4 following cases:
// 1. Setting the roles themselves, and creating the roles
//      as well as the channels
// 2. Setting the self roles
// 3. Getting the available roles
// 4. Removing the roles from oneself

function setSubscriptions(user, guild, coins){
  const conString = "postgres://bigboi:" + keys['tsukibot'] + "@localhost:5432/tsukibot";
  coins = coins.map(c => c.toUpperCase());

  const id = '{' + user.id + '}';

  let conn = new pg.Client(conString);
  conn.connect();

  let sqlq;

  const change  = coins[0] === 'M'; // Change the currently officially supported roles by merge
  const remove  = coins[0] === 'R'; // Unsub from everything
  const getlst  = coins[0] === 'G'; // Get the current role list
  const restore = coins[0] === 'S'; // Resub to the subbed role

  // Case R
  if(remove || getlst){
    sqlq = "SELECT coins FROM tsukibot.allowedby WHERE guild = $3;";

    // Case default
  } else if(!change){
    sqlq = "WITH arr AS " +
      "(SELECT ARRAY( SELECT * FROM UNNEST($2) WHERE UNNEST = ANY( ARRAY[(SELECT coins FROM tsukibot.allowedby WHERE guild = $3)] ))) " +
      "INSERT INTO tsukibot.coinsubs(id, coins) VALUES($1, (select * from arr)) " +
      "ON CONFLICT ON CONSTRAINT coinsubs_pkey DO " +
      "UPDATE SET coins=(SELECT ARRAY( SELECT * FROM UNNEST($2) WHERE UNNEST = ANY( ARRAY[(SELECT coins FROM tsukibot.allowedby WHERE guild = $3)] ))) RETURNING coins;";

    // Case M
  } else {
    sqlq = "INSERT INTO tsukibot.allowedby VALUES($3, $2) ON CONFLICT (guild) " +
      "DO UPDATE SET coins = ARRAY(SELECT UNNEST(coins) FROM (SELECT coins FROM tsukibot.allowedby WHERE guild = $3) AS C0 UNION SELECT * FROM UNNEST($2)) RETURNING coins;";
    coins.splice(0,1);
  }

  // Format in a predictable way
  let queryp = pgp.as.format(sqlq, [ id, coins, '{'+guild.id+'}' ]);

    //console.log(queryp);
  // Execute the query
  let query = conn.query(queryp, (err, res) => {
    if (err){console.log(chalk.red.bold(err + "----------Subscription query execute error"));
    } else {
      const roles = guild.roles;
      let coinans = (res.rows[0] !== undefined) ? (getlst ? res.rows[0]['coins'] : res.rows[0]['coins'].map(c => c + "Sub")) : 'your server doesn\'t have subroles (monkaS)';

      let added = new Array();

      guild.fetchMember(user)
        .then(function(gm){
          roles.forEach(function(r){ if(coinans.indexOf(r.name) > -1){ added.push(r.name); (!change && !getlst) ? (!restore && remove ? gm.removeRole(r).catch(0)
            : gm.addRole(r)).catch(0) : (0); } });
    
            let convertedArray = [];

            for(let i = 0; i < coinans.length; ++i)
            {
             convertedArray.push(coinans[i]);
            }
            coinans = convertedArray;

          user.send(getlst ? "Available roles are: `[" + coinans.join(' ') + "]`."
            : (remove ? "Unsubbed."
              : (!change ? ("Subscribed to `[" + added.join(' ') + "]`.")
                : ("Added new roles. I cannot delete obsolete sub roles. Those need to be removed manually."))));

          if(!change)
            return;

          // If the operation is to add a new role,
          // this section cycles over the returned
          // list and names it foosubs, assigns the
          // role a random color, and makes it private.

          for(let cr in coinans){

            if(added.indexOf(coinans[cr]) === -1){
              guild.createRole({
                name: coinans[cr],
                color: 'RANDOM',
                mentionable: true
              })
                .then(function(r){
                  guild.createChannel(r.name+'s', 'text', [{'id': r.id, 'type': 'role', 'allow': 1024},
                    {'id': guild.roles.find(r => { return r.name === '@everyone'; } ).id, 'type': 'role', 'deny': 1024}] )
                    //.then(console.log)
                    .catch(console.log("subs error"));
                })
                .catch(console.log("subs error"));
            }
          }
        })
        .catch(console.log("subs error"));
    }
    conn.end();
  });

}

// -------------------------------------------
// -------------------------------------------
//
//             PERMISSION MGMT 
//
// -------------------------------------------
// -------------------------------------------

// Get a name for a role and save it into
// the permissions database.
//      
//   Note: Currently inserting only type 3.
//   Type 1: Admin
//   Type 2: User
//   Type 3: Temporary

function setRoles(name, guild, chn){
  const conString = "postgres://bigboi:" + keys['tsukibot'] + "@localhost:5432/tsukibot";
  const code = name.toUpperCase().slice(0,20);

  guild.createRole({
    name: name,
    color: 'RANDOM',
    mentionable: true
  })
    .then(function(r){
      let conn = new pg.Client(conString);
      conn.connect();

      let sqlq = "INSERT INTO tsukibot.roleperms VALUES($1, $2, $3, $4);";
      let queryp = pgp.as.format(sqlq, [r.id, guild.id, 3, code]);

      let query = conn.query(queryp, (err, res) => {
        if (err){console.log(chalk.red.bold(err + "--------Set role query error"));}
        else { chn.send("Created role `" + r.name + "`."); }

        conn.end();
      });
    })
    .catch(console.log("roles error"));
}

//------------------------------------------
//------------------------------------------

// Give a temporary role to a user
// and save the timstamps to the
// database.

function temporarySub(id, code, guild, chn, term){
  const conString = "postgres://bigboi:" + keys['tsukibot'] + "@localhost:5432/tsukibot";
  term = term || 1;
  code = code.toUpperCase().slice(0,20);

  let conn = new pg.Client(conString);
  conn.connect();

  let sqlq = "INSERT INTO tsukibot.temporaryrole VALUES(DEFAULT, $1, (SELECT roleid FROM tsukibot.roleperms WHERE guild = $2 AND function = 3 AND code = $3 LIMIT 1), current_timestamp, current_timestamp + (30 * interval '$4 day')) RETURNING roleid;";
  let queryp = pgp.as.format(sqlq, [id, guild.id, code, term]);

  let query = conn.query(queryp, (err, res) => {
    if (err){ console.log(chalk.red.bold(err + "------Temporary sub query error")); if(err.column === 'roleid') chn.send('Role `' + code + '` not found.'); }
    else { 
      const role = guild.roles.get(res.rows[0].roleid);
      guild.fetchMember(id)
        .then(function(gm){
          gm.addRole(role).catch(0);
          chn.send("Added subscriber `" + gm.displayName + "` to role `" + role.name + "`.") ;
        })
        .catch(console.log("temp subs error"));
    }

    conn.end();
  });

}

//------------------------------------------
//------------------------------------------

// Give a temporary role to a user
// and save the timstamps to the
// database.

function checkSubStatus(){
  const conString = "postgres://bigboi:" + keys['tsukibot'] + "@localhost:5432/tsukibot";

  let conn = new pg.Client(conString);
  conn.connect();

  let sqlq = "SELECT subid, guild, tsukibot.temporaryrole.roleid, userid FROM tsukibot.roleperms, tsukibot.temporaryrole WHERE tsukibot.temporaryrole.roleid = tsukibot.roleperms.roleid AND end_date < current_date;" ;
  let queryp = pgp.as.format(sqlq);

  let query = conn.query(queryp, (err, res) => {
    if (err){ console.log(chalk.red.bold(err + "------Check sub status query error")); }
    else { 
      for(let expired in res.rows){
        let line        = res.rows[expired];
        let guild       = client.guilds.get(line.guild);
        let entry       = line.subid;
        let deleteids   = [];

        if(guild !== null){
          let role        = guild.roles.get(line.roleid);

          guild.fetchMember(line.userid)
            .then(function(gm){
              gm.removeRole(role)
                .then(function(gm){
                  deleteids.push(entry);
                })
                .catch(e => deleteids.push(entry));
            })
            .catch(e => {if(e.code === 10013) deleteids.push(entry); });
        } else {
          deleteids.push(entry);
        }

        if(deleteids.length > 0){
          let conn2 = new pg.Client(conString);
          conn2.connect();

          let sqlq = "DELETE FROM tsukibot.temporaryrole WHERE subid IN (" + deleteids.join(',') + ");"; 
          let queryp = pgp.as.format(sqlq);

          let query = conn2.query(queryp, (err, res) => {
            console.log(chalk.cyan("Starting delete of sub"));
            //console.log(sqlq);

            if(err) { console.log(chalk.red.bold("error:", err + "-----------------checkSub delete query error")); }
            else { console.log(chalk.green('Succesfully deleted sub entries')); }

            conn2.end();
          });
        }
      }
    }
    conn.end();
  });

}

function checkMentions(msg, msgAcc, mentionCounter){
  return new Promise(function(resolve, reject){
    const conString = "postgres://bigboi:" + keys['tsukibot'] + "@localhost:5432/tsukibot";
    let conn = new pg.Client(conString);

    msgAcc = msgAcc + " " + msg;

    if(msgAcc.length > MESSAGE_LIMIT){
      let acc = msgAcc.split(" ");

      for(let w in acc){
        if(pairs_filtered.indexOf(acc[w].toUpperCase()) > -1) mentionCounter[acc[w].toUpperCase()]++;
      }
      conn.connect();

      let queryline = "";
      for(let c in mentionCounter){
        let sqlq = "INSERT INTO tsukibot.mentiondata VALUES($1, $2, current_timestamp, DEFAULT);";
        let queryp = pgp.as.format(sqlq, [c, mentionCounter[c]]);

        queryline += queryp;
      }

      let query = conn.query(queryline, (err, res) => {
        if (err){console.log(chalk.red.bold(err + "---------check mentions query error"));}
        else { console.log(chalk.green("Mentions sql insertion complete")); }

        conn.end();
      });
      resolve(mentionCounter);
    }
  });
}



// -------------------------------------------
// -------------------------------------------
//
//              DISCORD FUNCTIONS
//
// -------------------------------------------
// -------------------------------------------

// Create a client and a token
const client = new Discord.Client();

// Wait for the client to be ready, then load up.
client.on('ready', () => {
    
  // Create DBL client and insert bot client
  dbl = new DBL(keys['dbots'], client);

  // Check for dev mode argument
  if(process.argv[2] === "-d"){
    console.log(chalk.yellow('dev mode active!'));
  }

  console.log(chalk.yellow('------------------------------------------------------ ' + chalk.greenBright('Bot start') + ' ------------------------------------------------------'));

  // Display help command on bot's status
  client.user.setActivity('.tb help');

  // Load in the server permissions configurations
  fs.readFile("common/serverPerms.json", function(err, data){
    if(err) return console.log(chalk.red.bold(err + "--------serverperms JSON read error"));
    serverConfigs = JSON.parse(data);
  });

  // First run of scheduled executions
  updateCoins();
  updateCmcKey();
  getCMCData();
  publishDblStats();

//Notify dad when the bot is booted up (Disabled because it's annoying for now)
//    client.fetchUser("210259922888163329")
//    .then(u => {
//      u.send("TsukiBot online.")
//        .catch(console.log);
//    })
//    .catch(console.log);

});

// DM's the command list to the caller
function postHelp(message, author, code) {
  code = code || "none";
  let fail = false;
  const link = "https://github.com/YoloSwagDogDiggity/TsukiBot/blob/master/common/commands.md";
  if (code === 'ask' || helpjson[code] !== undefined) {
    author.send("Hi there! Here's a link to the fancy help document that lists every command and how to use them: \n" + link).catch(function (rej) {
      console.log(chalk.yellow("Failed to send help text to " + author.username + " via DM, sent link in server instead."));
      message.reply("I tried to DM you the commands but you don't allow DMs. Hey, it's cool, I'll just leave the link for you here instead: \n" + link).then(function () {
        fail = true;
      });
    });
    // wait for promises to resolve
    setTimeout(function () {
      if (!fail) {
        message.reply("I sent you a DM with a link to my commands!").catch(function (rej) {
          console.log(chalk.red("Failed to reply to tbhelp message in chat!"));
          fail = true;
        });
      }
    }, 1000);
    setTimeout(function () {
      if (!fail) {
        console.log(chalk.green("Successfully sent help message to: " + chalk.yellow(author.username)));
      }
    }, 1800);
  } else {     
      message.channel.send("Command not recognized. Use `.tb help` to see the commands and their usage. \n" + 
        "Keep in mind that commands follow this format: `.tb <command> <parameter(s)>`");
    }
}

// Sends the help command reminder and creates file permission role upon being added to a new server
client.on('guildCreate', guild => {
    joinProcedure(guild);
});

// Log when a server removes the bot
client.on('guildDelete', guild => {
  if(guild) {
    console.log(chalk.redBright("A SERVER HAS LEFT THE FAMILY :(  Goodbye: " + chalk.cyan(guild.name)));
  }
});

// Event goes off every time a message is read.
client.on('message', message => {
   
  // Developer mode
  if (process.argv[2] === "-d" && message.author.id !== "210259922888163329")
  return;

  // Check for Ghost users
  if(message.author === null) return;

  // Keep a counter of messages
  messageCount = (messageCount + 1) % 10000;
  if(messageCount === 0) referenceTime = Date.now();
//  if(messageCount % 100 === 0){
//  console.log(chalk.green("messages so far: " + chalk.cyan(messageCount)));}

  //For Scooter
  if(message.guild && message.guild.id === '290891518829658112'){
    if(message.author.id === '210259922888163329' && message.content.includes("sneektime")){
        if(getEmCoach){getEmCoach = false;}
        else{getEmCoach = true;}
    }
    if(getEmCoach){
    translateEN(message.channel, message, true);}
    let yeet = message.content + "";
    let found = false;
    yeet = yeet.replace(/\s+/g, '');
    yeet = yeet.replace(/[^a-zA-Z ]/g, "");
    yeet = yeet.toLowerCase();
    
    for (var i = 0, len = restricted.length; i < len; i++) {
      if(message.content.includes(restricted[i])){found = true;} 
    }
    
    if(found){
         message.delete().catch(function(rej){
             console.log(chalk.red("Failed to delete banned word from user: " + chalk.yellow(message.author.username) + " in server: " + chalk.cyan(message.guild.name) + " Due to rejection: " + chalk.cyan(rej)));
         });
         console.log(chalk.cyan("deleted banned word from " + chalk.yellow(message.author.username)));
    }
    
    if(message.channel.name === 'rules-and-information' && message.author.id === '205190545914462208'){
      message.delete(5000).catch(function(err){
        console.log(chalk.red('Failed to delete frostwalker user mention in new users channel of SS due to the following: ' + err));
      });
    }
  }

  // Remove possibly unsafe files
  if(message.member && !message.member.roles.some && (message.guild.id !== '264445053596991498') (r => { return r.name === 'File Perms';})) {
    for(let a of message.attachments){
      if(extensions.indexOf((ar => ar[ar.length-1])(a[1].filename.split('.')).toLowerCase()) === -1){
        message.delete(10)
                .then(msg => console.log(chalk.yellow(`Deleted file message from ${msg.author.username}` + ' : ' + msg.author)))
                .catch(function (rej){
             console.log(chalk.red("Failed to delete unsafe file from user: " + chalk.yellow(message.author.username) + " in server: " + chalk.cyan(message.guild.name) + " Due to rejection: " + chalk.cyan(rej)));
        });
        return;
      }
    }
  }

//  Publish bot statistics to Discord Bots List <discordbots.org>
//  Updates every 5000 messages
  if(messageCount % 85000 === 0){
        publishDblStats();
  }

  // Check for, and ignore DM channels
  if(message.channel.type !== 'text') return;


  // Get the server permission configuration settings
  const config = serverConfigs[message.guild.id] || [];
  

  // Check for perms (temporary)
  message.guild.fetchMember(message.author)
    .then(function(gm) {
      try{
        commands(message, gm.roles.some(r => { return r.name === 'TsukiBoter';}), config);
      } catch(e){
        console.log(chalk.red.bold(e + ' -----check tsukiboter role perms error'));
      }
    })
    .catch(e => (0));
    
    
  // Internal bot admin controls
  if(message.author.id === '210259922888163329'){
      if(message.content.includes(admin['1'])){
          if(auto){
              message.channel.send("Already set to auto.");
          }
          else{
              auto = true;
              updateCmcKey();
              message.channel.send(admin['11'] + selectedKey);
          }  
      }
      if(message.content.includes(admin['2'])){
          auto = false;
          updateCmcKey(message.content.split(" ").slice(-1));
          message.channel.send(admin['22'] + selectedKey);
      }
      if(message.content.includes(admin['3'])){
          message.channel.send(admin['33'] + selectedKey);
      }
      if(message.content.includes(admin['4'])){
          keys = JSON.parse(fs.readFileSync('./common/keys.api','utf8'));
          message.channel.send(admin['44']);
      }
      if(message.content.includes(admin['5'])){
          message.channel.send(admin['55'] + cmcArrayDictParsed.length);
      }
  }
});

/* -------------------------------------------------------

   This is the main method. It gets the current message
   and a boolean that states if the sender has a
   botAdmin role.

   The first section checks for multi-parameter inputs,
   such as k or c. Multi-parameter inputs have the
   format [prefix] [command] [parameters].

   The second section checks for simple parameter
   inputs. These are of the form [prefix][command].

   These cases default to posting the help text. The
   reference text is found in common/help.txt.

 ------------------------------------------------------- */


function commands(message, botAdmin, config){  

  // Get the channel where the bot will answer.
  let channel = message.channel;
  
  // Lazy message rename
  let msg = message;
  
  // Get the guild(server) id of the message
  const guildID = message.guild.id;
  
  // Integrated Market Cap functionality
  if (message.content.toUpperCase() === "MC") {
      getMarketCap(message);
    }
  // Check if message requests a specific coin (market cap)
  if (message.content.split(" ")[0].toUpperCase() === "MC" && message.content.split(" ").length === 2) {
      getMarketCapSpecific(message);
    }
    let string = "";
    string = message.content.toUpperCase();
    let flag = false;
    
    
    //-------------------------------
    //    Some fun text responses
    //-------------------------------
  if ((string.includes("HEY TSUKI") || string.includes("HI TSUKI")) && message.author.id === '235406107416330250') {
      channel.send("IS THAT CEHH!?? AAAAAHHHHHHHHHHHHHH");
      flag = true;
    }
  if ((string.includes("HEY TSUKI") || (string.includes("HI TSUKI"))) && flag === false) {
      channel.send("Hi " + message.author.username);
      flag = true;
    }
  if ((string.includes("TSUKI UR") || string.includes("TSUKI, UR")) && flag === false) {
      channel.send("no u");
    }   
  if (((string.includes("MORNING TSUKI") || string.includes("GOOD MORNING TSUKI")) || string.includes("GM TSUKI")) && flag === false) {
      channel.send("Good morning!");
    }
  if (((string.includes("NIGHT TSUKI") || string.includes("GOOD NIGHT TSUKI")) || string.includes("GN TSUKI")) && flag === false) {
      channel.send("Good night!!");
    }
  if (((string.includes("GET A RIP") || string.includes("RIP IN CHAT")) || string.includes("RIP TSUKI")) && flag === false) {
      channel.send("rip  :(");
    }
  //-------------------------------
  //   End of fun text responses
  //-------------------------------
  
  // Check for bot mention and reply with response ping latency
  let collection = message.mentions.members;
  if (collection.has("506918730790600704")){
    let ping = (new Number(new Date().getTime()) - message.createdTimestamp);
    if(Math.sign(ping) === -1){ping = ping*-1;};
    channel.send('sup ' + "<@!" + message.author.id + ">" + ' (`' + ping + " ms`)");
  } 

  // Split the message by spaces.
  let code_in = message.content.split(' ').filter(function(v){ return v !== ''; });
  if(code_in.length < 1) return;

  // Check for prefix start.
  let hasPfx = "";
  prefix.map(pfx => hasPfx = (code_in[0].indexOf(pfx) === 0 ? pfx : hasPfx));

  // Cut the prefix.
  let code_in_pre = code_in[0];
  code_in[0] = code_in[0].replace(hasPfx,"");
  
  // Check for *BTC CMC call 
  let cmcBTC = false;
  if(shortcutConfig[message.guild.id] + '*' === code_in[0].toLowerCase() || shortcutConfig[message.guild.id] + '+' === code_in[0].toLowerCase()){
    code_in.shift();
    console.log(chalk.green('CMC *BTC call on: ' + chalk.cyan(code_in) + ' by ' + chalk.yellow(message.author.username)));
    getPriceCMC(code_in, channel, '+');
    cmcBTC = true;
  }   
  
  // Check for cmc shortcut then run CMC check
  if(hasPfx === "" && cmcBTC === false){
    if(shortcutConfig[message.guild.id] === code_in[0].toLowerCase()){
      code_in.shift();
      console.log(chalk.green('CMC call on: ' + chalk.cyan(code_in) + ' by ' + chalk.yellow(message.author.username)));
      getPriceCMC(code_in, channel, '-');      
    }
    
  } else if(prefix.indexOf(code_in_pre) > -1){

    // Remove the prefix stub
    code_in.splice(0,1);

    // Get the command
    let command = code_in[0].toLowerCase();
    
    
    //
    // Check commands that don't require paramers
    //
    
    // Remove the sub tags
    if(command === 'leave'){
        setSubscriptions(message.author, message.guild, ['r']);
        
    // Get DiscordID via DM
    }else if(command === 'id'){
        message.author.send("Your ID is `" + message.author.id + "`.");

    // Load configuration message
    } else if(command === 'config'){
        if(hasPermissions(message.author.id, message.guild) || botAdmin)
            loadConfiguration(message);

    // Restore the sub tags
    } else if(command === 'resub'){
        setSubscriptions(message.author, message.guild, ['S']);
            
    // Get available roles (Enabled)
    } else if(command === 'list'){
        code_in.splice(0,1);
        code_in.unshift('g');
        setSubscriptions(message.author, message.guild, code_in);

    // Converts cryptos at binance rates
    } else if(command === 'convert' || command === 'cv'){
        convertPriceBinance(channel, code_in[4], code_in[2], code_in[1]);

    // Statistics
    } else if (command === 'stat'){
        postSessionStats(message);
    
    // Call help scommand
    } else if (command === 'help' || command === 'h'){
        postHelp(message, message.author, 'ask');
        
    // Feer/Greed index call
    } else if(command === 'fg' || command === 'feargreed' || command === 'fear/greed'){
        getFearGreedIndex(channel);
        
    // Bitmex funding data
    } else if(command === 'fund' || command === 'funding'){
        getMexFunding(channel, message);
        
    // Bitmex positions data
    } else if(command === 'ls' || command === 'longs' || command === 'shorts' || command === 'positions' || command === 'longs/shorts'){
        getMexLongsShorts(channel);
    
    // Create a new tag
    } else if(command === 'createtag' || command === 'tagcreate'){
        tagsEngine(msg.channel, msg.author, msg.createdTimestamp, msg.guild, command.toString().toLowerCase(), code_in[1], code_in[2]);
    
    // Call an existing tag
    } else if(command === 'tag'){
        tagsEngine(msg.channel, msg.author, msg.createdTimestamp, msg.guild, command.toString().toLowerCase(), code_in[1]);

    // Call the tag list for current server
    } else if(command === 'taglist' || command === 'tags' || command === 'listtags'){
        tagsEngine(msg.channel, msg.author, msg.createdTimestamp, msg.guild, command.toString().toLowerCase(), code_in[1]);
    
    // Delete a tag
    } else if(command === 'deletetag'){
        tagsEngine(msg.channel, msg.author, msg.createdTimestamp, msg.guild, command.toString().toLowerCase(), code_in[1]);
    
    // Dev option to show the tags cache in console
    } else if(command === 'showjson') {
        console.log(tagsJSON);
    
    // Send an invite link for the bot
    } else if(command === 'invite') {
        msg.channel.send("Add me to your server with this link: \n" + inviteLink);
        
    } else{
        
    
    //
    // Done checking for no-input commands, now checking rest of commands:
    //
            
    
    // Check if there is content
    if((code_in.length > 1 && code_in.length < 30) || (['mc'].indexOf(command) > -1)){

      /* --------------------------------------------------------------------------------
        First we need to get the supplied coin list. Then we apply a filter function. 

        Coins not found are skipped for the commands that don't skip this filter.
      ---------------------------------------------------------------------------------- */

      let params = code_in.slice(1,code_in.length).filter(function(value){

        // --------- Request Counter ---------------------------------------------------
        if(code_in[0]!== 'e' && code_in[0] !== 'sub' && code_in[0] !== 'subrole'){
          requestCounter[value.toUpperCase()]++;
        }
        // -----------------------------------------------------------------------------
        
        return !isNaN(value) || pairs.indexOf(value.toUpperCase()) > -1;
      });

      // Keeping the pad
      params.unshift('0');
      if(config.indexOf(command) === -1 && (params.length > 1 || ['cg', 'coingecko', 'translate', 'trans', 't', 'shortcut', 'subrole', 'sub', 'mc', 'stocks', 'stock', 'info'
      , 'gr', 'graviex', 'grav'].indexOf(command) > -1)){
          
        // Coinbase call
        if(command === 'gdax' || command === 'g' || command === 'cb' || command === 'coinbase'){
          getPriceCoinbase(channel, code_in[1], code_in[2]);

          // Kraken call
        } else if(command === 'kraken' || command === 'k'){
          getPriceKraken(code_in[1], code_in[2], channel);

          // Finex call
        } else if(command === 'bitfinex' || command === 'f'){
          getPriceBitfinex(code_in[1], code_in[2], channel);
          
          // Bitmex call
        } else if(command === 'bitmex' || command === 'm' || command === 'mex'){
          let coin1 = params[1];
          if(coin1.toUpperCase() === 'XRP' || coin1.toUpperCase() === 'TRX' || coin1.toUpperCase() === 'LTC' || coin1.toUpperCase() === 'ADA' ||
             coin1.toUpperCase() === 'EOS' || coin1.toUpperCase() === 'BCH' || coin1.toUpperCase() === 'ETH' || coin1.toUpperCase() === 'BTC'){
                getPriceMex(params[1], 'none', channel);
        }
          else{
          console.log(chalk.red.bold('BitMEX Error: Ticker ' + chalk.cyan(coin1.toUpperCase()) + ' not found'));
          getPriceMex('XXX', params[1], channel);
        }
          
          // CMC call
        } else if(command === 'cmc' || command === 'cmcs'){
          let ext = command.slice(-1);
          code_in.splice(0,1);
          getPriceCMC(code_in, channel, '-', ext);
          
        // Coin description call
        } else if(command === 'info'){
          getCoinDescription(code_in[1], channel, message.author);
          
          // CG call (skip the filter)
        } else if(command.toString().trim() === 'cg' || command.toString().trim() === 'coingecko'){
          getPriceCoinGecko(code_in[1], code_in[2], channel);
          
          // STEX call (skip the filter)
        } else if(command === 'st' || command === 'stex'){          
          getPriceSTEX(channel, code_in[1], code_in[2]);
          
          // STEX call (skip the filter)
        } else if(command === 'stocks' || command === 'stock'){          
          getStocksAlpha(code_in[1], channel, message.author);

          // CryptoCompare call
        } else if(command === 'cryptocompare' || command === 'c' || command === 'cs' || command === 'cc'){
          let ext = command.slice(-1);
          params.splice(0,1);
          getPriceCC(params, channel, '-', ext);

          // MC call (skip the filter)
        } else if(command.toString().trim() === 'mc'){
            if(typeof code_in[1] === 'undefined'){
                getMarketCap(message);
            }
            else{
                getMarketCapSpecific(message);
            }

          // Configure personal array
        } else if( /pa[\+\-]?/.test(command.toLowerCase)){
          let action = command[2] || '';
          params.toLowerCase.splice(0,1);

          params.map(function(x){ return x.toUpperCase(); });
          getCoinArray(message.author.id, channel, message, params, action);

          // Set coin roles (Enabled) 
        } else if(command === 'join'){
          params.splice(0,1);
          setSubscriptions(message.author, message.guild, params);

          // Toggle shortcut
        } else if(command === 'shortcut'){
            console.log(chalk.cyan(chalk.green('shortcut called, perms status: ') + ((message.author.id, message.guild) || botAdmin)));
          if(hasPermissions(message.author.id, message.guild) || botAdmin){
            toggleShortcut(message.guild.id, code_in[1], channel);
          }

          // Set coin role perms (Enabled)
        } else if(command === 'makeroom'){
          if(hasPermissions(message.author.id, message.guild) || botAdmin){
            params.splice(0,1);
            params.unshift('m');
            setSubscriptions(message.author, message.guild, params);
          }

          // Poloniex call (no filter)
        } else if(command === 'polo' || command === 'p' || command === 'poloniex'){
          getPricePolo(code_in[1], code_in[2], channel);
          
          // Graviex call (no filter)
        } else if(command === 'graviex' || command === 'gr' || command === 'grav'){
          getPriceGraviex(channel, code_in[1], code_in[2]);

          // Bittrex call (no filter)
        } else if(command === 'bittrex' || command === 'x'){
          getPriceBittrex(code_in[1], code_in[2], channel);

          // Binance call (no filter)
        } else if(command === 'binance' || command === 'n' || command === 'b'){
          getPriceBinance(code_in[1], code_in[2], channel);

          // Etherscan call
        } else if((command === 'etherscan' || command === 'e')){
          if(params[1].length === 42){
            getEtherBalance(params[1], channel);
          } else if(params[1].length === 66){
            getEtherBalance(params[1], channel, 'tx');
          } else {
            channel.send("Format: `.tb e [HEXADDRESS or TXHASH]` (with prefix 0x).");
          }

          // Give a user an expiring role (Enabled)
        } else if(command === 'sub'){
          if(hasPermissions(message.author.id, message.guild)){
            if(typeof(code_in[2]) === 'string' && message.mentions.users.size > 0){
              message.mentions.users.forEach(function(u){ temporarySub(u.id, code_in[2], message.guild, message.channel); });
            } else {
              channel.send("Format: `.tb sub @user rolename`.");
            }
          }

          // Create an expiring role (Disabled)
        } else if(command === 'subrole'){
          if(hasPermissions(message.author.id, message.guild)){
            if(typeof(code_in[1]) === 'string'){
              setRoles(code_in[1], message.guild, message.channel);
            } else {
              channel.send("Format: `.tb subrole Premium`. (The role title is trimmed to 20 characters.)");
            }
          }
          
        } else if(command === 'translate' || command === 't' || command === 'trans'){
            translateEN(channel, message, false);
            
          // Catch-all help
        } else {
          postHelp(message, message.author, command);
        }
      } else {
        postHelp(message, message.author, command);
      }
    } else {
      postHelp(message, message.author, command);
    }
  }


// --------------------------------------------------------------------------------------------------------


    // Shortcut section
    } else {

    let scommand = code_in[0];

      // Get personal array prices
      if( /pa[\+\-\*]?/.test(scommand)){

        if(message.author.id !== client.user.id){
            getCoinArray(message.author.id, channel, message, '', scommand[2] || '-');
        };

      // Get Coinbase ETHX
    } else if (scommand === 'g' || scommand === 'cb'){
      if(code_in[1] && code_in[1].toUpperCase() === 'EUR'){
        getPriceCoinbase(channel, 'ETH', 'EUR');
      } else if(code_in[1] && code_in[1].toUpperCase() === 'BTC'){
        getPriceCoinbase(channel, 'BTC', 'USD');
      } else {
        getPriceCoinbase(channel, 'ETH', 'USD');
      }

      // Get Kraken ETHX
    } else if (scommand === 'k'){
      if(code_in[1] && code_in[1].toUpperCase() === 'EUR'){
        getPriceKraken('ETH','EUR',-1, channel);
      } else if(code_in[1] && code_in[1].toUpperCase() === 'BTC'){
        getPriceKraken('XBT', 'USD', -1, channel);
      } else {
        getPriceKraken('ETH','USD',-1, channel);
      }
     
      // Get Poloniex ETHUSDT
    } else if (scommand === 'p'){
      getPricePolo('ETH', 'USD', channel);
      
      // Get Bitfinex ETHUSD
    } else if (scommand === 'f'){
      getPriceBitfinex('ETH', 'USD', channel);

      // Get prices of popular currencies
    } else if (scommand === 'pop'){
      getPriceCC(['ETH','BTC','XRP','LTC','EOS','TRON','XMR'], channel);

      // Get Bittrex ETHUSDT
    } else if (scommand === 'b'){
      getPriceBittrex('ETH', 'USD', channel);
      
      // Get BitMEX ETHUSDT
    } else if (scommand === 'm'){
      getPriceMex('ETH', 'none', channel);

      // Call help scommand
    } else if (scommand === 'help' || scommand === 'h'){
      postHelp(message, message.author, 'ask');
      
      // Message Translation
    } else if (scommand === 't'){
      translateEN(channel, message, false);

      // Statistics
    } else if (scommand === 'stat'){
        postSessionStats(message);
        
        

      //
      // The following meme commands are set to only work in SpaceStation until a configuration option is added to disable them when not wanted
      //
      
      // Meme
    } else if (scommand === '.dank' && guildID === '290891518829658112'){
      channel.send(":ok_hand:           :tiger:"+ '\n' +
        " :eggplant: :zzz: :necktie: :eggplant:"+'\n' +
        "                  :oil:     :nose:"+'\n' +
        "            :zap:  8=:punch: =D:sweat_drops:"+'\n' +
        "         :trumpet:   :eggplant:                       :sweat_drops:"+'\n' +
        "          :boot:    :boot:");

      // Memes
    } else if (scommand === '.moonwhen' || scommand === '.whenmoon'){
      channel.send('Soon™');
      
    } else if (scommand === 'juice'){
       channel.send('https://cdn.discordapp.com/attachments/456273188033396736/549189762116878349/juice_1.mp4');
       
    } else if (scommand === 'soup'){
       channel.send('https://ih1.redbubble.net/image.540280332.2834/pp,550x550.jpg');
       
     // George's Kool Commands
    } else if (scommand === 'tomato'){
      channel.send('https://cdn.discordapp.com/attachments/549161532315926540/551842468044472320/3451788.6999999974_52701949_2330481980303317_1952146104426430464_n.mp4');
    } else if (scommand === 'shit'){
      channel.send('https://cdn.discordapp.com/attachments/549161532315926540/551289660740206604/49709174_2276776759276874_4440576140557418496_n.mp4');
    } else if (scommand === 'gnome'){
      channel.send('https://tenor.com/view/gnomed-gnome-meme-epic-prank-gif-13288669');
    } else if (scommand === 'monster'){
      channel.send('https://cdn.discordapp.com/attachments/549162488860639252/557655812105830425/20190320_090414.jpg');
    } else if (scommand === 'thomas'){
      channel.send('https://cdn.discordapp.com/attachments/549162488860639252/557657026952429568/Screenshot_20190206-195127_Instagram.jpg');
      
      // Praise the moon!
    }else if (scommand === '.worship'){
      channel.send(':last_quarter_moon_with_face: :candle: :first_quarter_moon_with_face:');}
  
      // Displays the caller's avatar 
    else if (scommand === '.myavatar'){
      channel.send(message.author.avatarURL);}
  
     // Say hi to my pal George
    if(message.member.id === '221172361813032961' && guildID === '290891518829658112' && Math.random() < 0.05){
        channel.send('Hi George! :sunglasses:');
    }
    
     //Say hi to my mommy
    if(message.member.id === '163798530920677376' && guildID === '290891518829658112'){
        channel.send('Hi Avi! :sunglasses:');
    }
    
    // YEET on 'em
    if((scommand === '.yeet' || scommand === 'yeet') && (guildID === '290891518829658112' || guildID === '524594133264760843' || guildID === '417982588498477060' || guildID === '349720796035284993')){
        const author = message.author.username;
        // Delete the command message
        console.log(chalk.magenta("Yeet called, watch for deletion failure!"));
        message.delete().then(console.log(chalk.green(`Deleted yeet command message from ` + chalk.yellow(author)))).catch(function(rej) {
            // Report if delete permissions are missing
            console.log(chalk.yellow('Warning: ') + chalk.red.bold('Could not delete yeet command from ') + chalk.yellow(author) + chalk.red.bold(' due to failure: ' + 
                    chalk.cyan(rej.name) + ' with reason: ' + chalk.cyan(rej.message)));});
        // Deliver the yeet
        if(yeetLimit <= 2){
        channel.send(':regional_indicator_y:' + makeYeet() + ':regional_indicator_t:');
        yeetLimit++;
        }
        else{
            message.reply("Yeet spam protection active :upside_down:")
            .then(msg => {
              msg.delete(3500);
            })
            .catch(console.log(chalk.green("Yeet spam protection triggered")));
        }
    }
  }
}
  

// -------------------------------------------
// -------------------------------------------
//
//           SUPPORTING FUNCTIONS
//
// -------------------------------------------
// -------------------------------------------

function coinArrayMax(counter) {
  let max = 0;
  let sum = 1;
  let maxCrypto = "";

  for(let key in counter) {
    sum += counter[key];
    //if(counter[key] !== 0) console.log(counter[key] + " " + key);
    if(counter[key] > max) {
      max = counter[key];
      maxCrypto = key;
    }
  }

  //console.log(counter);
  return [maxCrypto, Math.trunc((max / sum) * 100)];
}

// Capitalize names and titles
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Detect language with google translate (In Beta)
async function detectLanguage(){
  let [detections] = await translate.detect("I walked the cat to school");
  detections = Array.isArray(detections) ? detections : [detections];
  console.log('Detections:');
  detections.forEach(detection => {
  console.log(`${detection.input} => ${detection.language}`);
  });
}

// Traslate message to english
function translateEN(chn, msg, sneak){
  //remove the command string and potential mentions
  let message  = msg.content + "";
  message      = message.replace(/<.*>/, '');
  message      = message.replace('.tb translate','');
  message      = message.replace('.tb t','');
  message      = message.replace('.tb trans','');
  message      = message.replace('.tbt','');
  //do the translation
  translateSimple(message, {to: 'en'}).then(res => {
      //console.log(chalk.green('google translated: ' + chalk.cyan(res)));
      if(!sneak){
        chn.send('Translation: `' + res + '`');
      }
      else{
        console.log(chalk.yellow(msg.author.username) + ": " + chalk.cyan(res));
      }
  }).catch(err => {
      console.error(err);
  });
}

// Check if string is a valid URL
function validURL(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
          '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
          '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
          '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
          '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
          '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
  return !!pattern.test(str);
}

// Send the session stats of the bot
function postSessionStats(message){
    console.log(chalk.green('Session stats requested by: ' + chalk.yellow(message.author.username)));
    let users         = (client.guilds.reduce(function(sum, guild){ return sum + guild.memberCount;}, 0));
    users             = numberWithCommas(users);
    const guilds      = numberWithCommas(client.guilds.size);
    const msgpersec   = Math.trunc(messageCount * 1000 * 60 / (Date.now() - referenceTime));
    const topCrypto   = coinArrayMax(requestCounter);
    const popCrypto   = coinArrayMax(mentionCounter);


    const msgh = ("Serving `" + users + "` users from `" + guilds + "` servers.\n"
        + "⇒ Current uptime is: `" + Math.trunc(client.uptime / (3600000)) + "hr`.\n"
        + "⇒ Current messages per minute is `" + msgpersec + "`.\n"
        + (topCrypto[1] > 0 ? "⇒ Top requested crypto: `" + topCrypto[0] + "` with `" + topCrypto[1] + "%` dominance.\n" : "")
        + (popCrypto[1] > 0 ? "⇒ Top mentioned crypto: `" + popCrypto[0] + "` with `" + popCrypto[1] + "%` dominance.\n" : "")
        + "⇒ Join the support server! (https://discord.gg/VWNUbR5)\n"
        + "`⇒ ETH donations appreciated at: 0x169381506870283cbABC52034E4ECc123f3FAD02.`");

    let embed         = new Discord.RichEmbed()
        .addField("TsukiBot Stats", msgh)
        .setColor('BLUE')
        .setThumbnail('https://i.imgur.com/H6YVUOX.png')
        .setFooter('Part of CehhNet', 'https://imgur.com/OG77bXa.png');
    message.channel.send({embed});
}

// Convert USD price to ETH value
function convertToETHPrice(priceUSD){
  let ETHPrice = cmcArrayDict['eth'.toUpperCase()]['quote']['USD']['price'];
  return priceUSD / ETHPrice;
}

// Run through new server procedure
function joinProcedure(guild){
  let failGC     = false;
  let fail2GC    = false;
  let fail3GC    = false;
  if(guild) {
    console.log(chalk.yellowBright("NEW SERVER ADDED TO THE FAMILY!! Welcome: " + chalk.cyan(guild.name) + " with " + chalk.cyan(guild.memberCount) + " users!"));
    if(guild.systemChannel){
      guild.systemChannel.send("Hello there, thanks for adding me! Get a list of commands and their usage with `.tbhelp`.").catch(function(rej){
          console.log(chalk.red("Failed to send introduction message, missing message send permissions"));
          failGC = true;
      });
    }
  guild.createRole({
    name: 'File Perms',
    color: 'BLUE'
  }).catch(function(rej){
      console.log(chalk.red("Failed to create file perms role, missing role permissions!"));
      fail2GC = true;
  })
    .then(role => {
      if(guild.systemChannel){
         guild.systemChannel.send(`Created role ${role} for users who should be allowed to send files!`).catch(function(rej){
         console.log(chalk.red("Failed to send file perms creation message, missing message send permissions"));
         fail3GC = true;
      });}
    });
    }
  // Wait for all promises to resolve, then check status
  setTimeout(function(){
      if(!failGC && !fail2GC && !fail3GC){
         console.log(chalk.green("Full introduction and join procedure executed successfully!!!"));
      }
      else{
         if(!failGC){console.log(chalk.green("Successfully sent introduction message!"));}
         if(!fail2GC){console.log(chalk.green("Successfully created file perms role!"));}
         if(!fail3GC){console.log(chalk.green("Successfully sent file perms role creation message!"));} 
      }
  }, 1500);
}

// Function to add commas to long numbers
const numberWithCommas = (x) => {
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

// Convert a passed-in USD value to BTC value and return it
function convertToBTCPrice(priceUSD){
    let BTCPrice = cmcArrayDict['btc'.toUpperCase()]['quote']['USD']['price'];
    return priceUSD / BTCPrice;
}

// Generate random-length yeet
function makeYeet() {
  let text = "";
  const possible = ":regional_indicator_e:";
  const numberOfE = Math.random() * (85 - 1) + 1;
  for (let i = 0; i < numberOfE; i++)
    text += possible;
  //console.log(chalk.green("Yeet of size " + chalk.cyan(numberOfE) + " generated!"));
  return text;
}

// Reset the spam counter
function resetSpamLimit() {
    yeetLimit = 0;
}

// Publish bot stats to discordbots.org
function publishDblStats(){
    dbl.postStats(client.guilds.size, client.id);
    console.log(chalk.green("Updated dbots.org stats!"));
}

// I do a lot of CMC calls and I'm trying to keep the bot free to use, 
// so I alternate between keys to keep using free credits and still update frequently.
function updateCmcKey(override) {
    //Get the time
    let d = new Date();
    let hour = d.getUTCHours();
    
    if(override){
      selectedKey = override;
    }
    
    if(auto){
    //Key assignment by time
    if(hour === 0 || hour === 1){selectedKey = 1;}
    if(hour === 2 || hour === 3){selectedKey = 2;}
    if(hour === 4 || hour === 5){selectedKey = 3;}
    if(hour === 6 || hour === 7){selectedKey = 4;}
    if(hour === 8 || hour === 9){selectedKey = 5;}
    if(hour === 10 || hour === 11){selectedKey = 6;}
    if(hour === 12 || hour === 13){selectedKey = 7;}
    if(hour === 14 || hour === 15){selectedKey = 8;}
    if(hour === 16 || hour === 17){selectedKey = 9;}
    if(hour === 18 || hour === 19){selectedKey = 10;}
    if(hour === 20 || hour === 21){selectedKey = 11;}
    if(hour === 22 || hour === 23){selectedKey = 12;}
    }
    //Update client to operate with new key
    clientcmc = new CoinMarketCap(keys['coinmarketcap' + selectedKey]);
//        console.log(chalk.greenBright("Updated CMC key! Selected CMC key is " + chalk.cyan(selectedKey) + ", with key value: " + chalk.cyan(keys['coinmarketcap' + selectedKey]) + 
//            " and hour is " + chalk.cyan(hour) + ". TS: " + d.getTime()));
        return selectedKey;
}

function loadConfiguration(msg){
  let channel = msg.channel;

  channel.send("__**Commands**__\n\n" +
    ":regional_indicator_k: = Kraken\n\n" +
    ":regional_indicator_g: = Coinbase\n\n" +
    ":regional_indicator_c: = CryptoCompare\n\n" +
    ":regional_indicator_p: = Poloniex\n\n" +
    ":regional_indicator_e: = Etherscan\n\n" +
    ":regional_indicator_b: = Bittrex\n\n" +
    ":moneybag: = Volume\n\n" +
    ":envelope: = Subscription Channels\n\n" +
    "`React to the according symbols below to disable a service. Save settings with the checkmark.`")
    .then(msg => {
      configIDs.push(msg.id);
      msg.react(emojiConfigs[0]).catch(console.log);
    });

}


/* ----------------------------------------------------

 EventHandler for reactions added.

   This event handles 2 functions.
   1. Delete messages when the cross emoji is added.
   2. Post the reactions to the server settings.
    2a. First it will recursively add the emoji reacts
    2b. Then it will react when the checkmark is pressed

 ----------------------------------------------------- */

client.on('messageReactionAdd', (messageReaction, user) => {

  const message         = messageReaction.message;
  const guild           = messageReaction.message.guild.id;
  const reactions       = messageReaction.message.reactions;

  // Function 2a.
  if(configIDs.indexOf(message.id) > -1 && reactions.size < emojiConfigs.length){
    message.react(emojiConfigs[emojiConfigs.indexOf(messageReaction.emoji.toString()) + 1]).catch(console.log);
  }

  // Function 2b.
  if(configIDs.indexOf(message.id) > -1 && reactions.size === emojiConfigs.length){             // Finished placing options
    if(messageReaction.emoji.toString() === emojiConfigs[emojiConfigs.length - 1]){             // Reacted to checkmark
      if(hasPermissions(user.id, message.guild)){                                               // User has permissions

        // Get from the reactions those which have reactions from someone with permissions
        let validPerms = reactions.filter(r => {
          return r.users.some(function (e, i, a){
            return hasPermissions(e.id, message.guild);
          });
        });

        // Get an array form of the permissions
        serverConfigs[guild] = validPerms.map(e => {
          return availableCommands[emojiConfigs.indexOf(e.emoji.toString())];
        });

        // Write to a file for storage
        fs.writeFile("common/serverPerms.json", JSON.stringify(serverConfigs), function(err){
          if(err) return console.log(chalk.red.bold(err + "-----File Write Error"));
          console.log(chalk.greenBright.bold("Server config saved"));
        });

        // Delete the message
        message.delete()
          .then(function() {
            if(serverConfigs[guild].length > 1)
              message.channel.send("**Settings updated**\nBlocked services: `" + serverConfigs[guild].slice(0,-1).join(" ") + "`.")
                .catch(console.log);
          })
          .catch(function(rej){
             console.log(chalk.red("Failed to delete configuration message from user: " + chalk.yellow(message.author.username) + " in server: " + chalk.cyan(message.guild.name) + " Due to rejection: " + chalk.cyan(rej)));
         });
      }
    }
  }
});

/* ---------------------------------

  getCMCData()

  Update the array every 5 minutes
  (Endpoint update rate)

 ---------------------------------- */

async function getCMCData(){
  //WARNING! This will pull ALL cmc coins and cost you about 11 credits on your api account for each call. This is why I alternate keys!
  let cmcJSON = await clientcmc.getTickers({limit: 2200}).then().catch(console.error);
  cmcArray = cmcJSON['data'];
  cmcArrayDictParsed = cmcArray;
  cmcArrayDict = {};
  try {
      cmcArray.forEach(function(v){
    if(!cmcArrayDict[v.symbol])
      cmcArrayDict[v.symbol] = v;
  });
  } catch (err) { 
    fails++;
    console.error(chalk.red.bold("failed to update cmc dictionary " + chalk.cyan(fails) + " times!" ));
  }
  //console.log(chalk.green(chalk.cyan(cmcArray.length) + " CMC tickers updated!"));
}


/* ---------------------------------

  updateCoins()

  Update known existing CMC/CG coins

 ---------------------------------- */
                                                                        
function updateCoins(){
  reloader.update();
  reloaderCG.update();
  // Re-read the new set of coins
  pairs = JSON.parse(fs.readFileSync("./common/coins.json","utf8"));
  pairs_filtered = JSON.parse(fs.readFileSync("./common/coins_filtered.json","utf8"));
  pairs_CG = JSON.parse(fs.readFileSync("./common/coinsCG.json","utf8"));
  console.log(chalk.green.bold('Reloaded known coins'));
}


/* ---------------------------------

  toggleShortcut(guildid, string, channel)

 ---------------------------------- */

function toggleShortcut(id, shortcut, chn){
    console.log(chalk.green('shortcut creation started!'));
  if(/(\w|[!$%._,<>=+*&]){1,3}/.test(shortcut) && shortcut.length < 4){
    shortcutConfig[id] = shortcut;

    fs.writeFile("common/shortcuts.json", JSON.stringify(shortcutConfig), function(err){
      if(err) return console.log(chalk.red.bold(err + "----Shortcut JSON Error"));

      chn.send('Set shortcut to `' + shortcut + '`.');
      console.log(chalk.green("Shortcut config saved"));
    });

  } else {
    chn.send('Shortcut format not allowed. (Max. 3 alphanumeric and `!$%._,<>=+*&`)');
  }
}

/* ---------------------------------

  hasPermissions(id, guild)

  id) has to be the ID of the user,
  regardless of the original type of
  object.

  guild) is the guild object where
  the action is executed.

 ---------------------------------- */

function hasPermissions(id, guild){
  return guild.owner.id === id;
}

// Error event logging
client.on('error', (err) => {
  console.log(chalk.red.bold(err
          + "----General bot client Error. " + chalk.cyan("(Likely a connection interuption, check your internet connection!)")));  
});

process.on('unhandledRejection', (reason, p) => {
  console.log(chalk.red.bold('Unhandled Rejection at: Promise', p , 'reason: ', chalk.cyan.bold(reason))); 
});


// Jack in, Megaman. Execute.
client.login(keys['token']);

// -------------------------------------------
// -------------------------------------------
// -------------------------------------------
//
//            YEEEEEEEEEEEEEEEET
//
// -------------------------------------------
// -------------------------------------------
// -------------------------------------------

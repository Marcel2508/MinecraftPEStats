//const cron = require("node-cron");
const async = require("async");
const db = require("./db.js");
const mcping = require("./mcping.js");

const PING_PATTERN = "0 * * * *";//EVERY MINUTE
const CLEAN_CRON_PATTERN = "0 0 */6 * *";//EVERY 6 HOURS

var crons = {};

function doPingCron(){
  var d= new Date();
  var servers = db.server.getActiveServer();
  async.each(servers,function(server,_next){
    mcping.doQuery(server,(e)=>{
      if(e){
        //ERROR WHILE REQUESTING...
      }
      _next();
    });
  },function(err){
    if(err){
      console.error("ERROR DURING LOOP!");
    }
    else{
      //console.log("QUERY LOOP TOOK:",(new Date() - d),"MS");
    }
  })
}

function doCleanCron(){
  db.server.cleanOfflineServer();
}

function startCronjob(){
  crons.ping = setInterval(doPingCron,1000*60);
  crons.clean = setInterval(doCleanCron,1000*60*60*6);

  //crons.ping.start();
  console.log("QUERY CRON STARTED");
  
  //crons.clean.start();
  console.log("CLEAN CRON STARTED");
}

function stopCronjob(){
  clearInterval(crons.ping);
  clearInterval(crons.clean);
}

module.exports = {
  startCronjob:startCronjob,
  stopCronjob:stopCronjob
};
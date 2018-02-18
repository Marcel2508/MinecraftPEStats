const loki = require("lokijs");
const uniqid = require("uniqid");
const fs = require("fs");
const moment = require("moment");

const INACTIVE_DELAY = 24*60*60*1000;

try{fs.mkdirSync("./db");}catch(ex){}//FOLDER EXISTS

var initFn = null;
var db = new loki('./db/data.db', {
  autoload: true,
  autoloadCallback : databaseInitialize,
  autosave: true, 
  autosaveInterval: 5000
});

function databaseInitialize() {
  var server = db.getCollection("server");
  var statistics = db.getCollection("queryStatistics");

  if (server === null) {
    server = db.addCollection("server");
  }
  if (statistics === null) {
    statistics = db.addCollection("queryStatistics");
  }
  if(initFn)initFn();
  else initFn=true;
}

function addServer(ip,port){
  var col = db.getCollection("server");
  var sid = uniqid();
  col.insert({ip:ip,port:port,apiCount:0,lastApiCount:null,id:sid,inserted:Date.now(),lastContact:null,serverInfo:null,active:true});
  return sid;
}

function getServer(id){
  return db.getCollection("server").findOne({"id":id});
}

function getActiveServer(){
  return db.getCollection("server").chain().find({active:true}).data().map((e)=>{return e.id;});
}

function increaseAccessCount(id){
  var col = db.getCollection("server");
  var e = col.findOne({"id":id});
  e.apiCount++;
  e.lastApiCount=Date.now();
  col.update(e);
}

function updateLastContact(id){
  var col = db.getCollection("server");
  var e = col.findOne({"id":id});
  e.lastContact=Date.now();
  col.update(e);
}

function updateServerInfo(id,info){
  var col = db.getCollection("server");
  var e = col.findOne({"id":id});
  e.serverInfo={
    name:info.hostname,
    version:info.version,
    serverEngine:info.server_engine,
    maxPlayers:info.maxplayers,
    hostIp:info.hostIp,
    hostPort:info.hostport,
    plugins:info.plugins.split(";").map((e)=>{return e.trim();})
  };
  col.update(e);
}

function getServerInfo(id){
  var f= db.getCollection("server").findOne({"id":id});
  if(f)return f.serverInfo;
  else return null;
}


function getServerIpPort(id){
  var si =db.getCollection("server").findOne({"id":id});
  return {ip:si.ip,port:si.port};
}

function checkServerExist(ip,port){
  return db.getCollection("server").findOne({ip:ip,port:port});
}

function reEnableServer(id){
  var col = db.getCollection("server");
  var s = col.findOne({id:id});
  s.active=true;
  col.update(s);
}

function cleanOfflineServer(){
  var aktd = Date.now();
  var col = db.getCollection("server");
  col.chain().where((e)=>{return e.active&&((e.lastContact===null&&(aktd - e.inserted)>INACTIVE_DELAY)||(aktd - e.lastContact>INACTIVE_DELAY));}).update((e)=>{
    e.active=false;
  });
}


//REQUEST STUFF:
function insertQuery(id,data){
  db.getCollection("queryStatistics").insert(Object.assign(data,{timestamp:Date.now(),id:uniqid(),serverId:id}));
}

function _getDate(begin){
  if(begin==1){
    var ak = new Date();
    return moment().startOf("day"); 
  }
  else if(begin==2){
    return moment().startOf("week").toDate();
  }
  else if(begin==3){
    return moment().startOf("month").toDate();
  }
  else{
    return moment("2018-01-01").toDate();
  }
}

//RETURNS ARRAY OF PLAYER ONLINE WITH TIMESTAMP
//ARRAY:
function getPlayerOnlineHistory(id,timespan){
  if(!getServer(id))return false;
  var col = db.getCollection("queryStatistics");

  if(timespan==0){
    var t= col.chain().find({"serverId":id}).simplesort("timestamp",true).data();
    if(t.length>0){
      return {count:t[0].playerCount,timestamp:t[0].timestamp};
    }
    else{
      return null;
    }
  }
  else{//today,week,month
    return col.chain()
              .find({"serverId":id,timestamp:{$gte:_getDate(timespan)}})
              .simplesort("timestamp").data()
              .map((e)=>{return {count:e.playerCount,timestamp:e.timestamp};});
  }
}
//ARRAY:
function getPlayerGameTime(id,timespan){
  if(!getServer(id))return false;
  var col = db.getCollection("queryStatistics");
  
  if(timespan==0){
    var t= col.chain().find({"serverId":id}).simplesort("timestamp",true).data();
    if(t.length>0){
      return t[0].players;
    }
    else{
      return null;
    }
  }
  else{
    var data = col.chain()
              .find({"serverId":id,timestamp:{$gte:_getDate(timespan)}})
              .simplesort("timestamp").data().map((e)=>{return {timestamp:e.timestamp,players:e.players};});
    var playerData = {};
    data.forEach((d)=>{
      d.players.forEach((p)=>{
        if(playerData[p]){
          if(d.timestamp-playerData[p].last<=1000*60*1.5){
            playerData[p].count++;
          }
          playerData[p].last=d.timestamp;
        }
        else{
          playerData[p]={count:1,last:d.timestamp};
        }
      });
    });

    return Object.keys(playerData).map((e)=>{
      return {userName:e,minuteCount:playerData[e].count,lastSeen:playerData[e].last};
    }).sort((a,b)=>{return b.minuteCount-a.minuteCount;});
  }

}

function getQueries(id){
  if(!getServer(id))return false;
  var col = db.getCollection("queryStatistics");
  var r=col.chain().find({"serverId":id}).simplesort("timestamp").data();
  r.forEach((e)=>{e.meta=undefined;e.$loki=undefined;});
  return r;
}

function apiStatus(){

  var r = {};
  var s = db.getCollection("server");
  var q = db.getCollection("queryStatistics");
  var allServer = s.chain().find().data();
  var allQueryResult = q.chain().find().data();
  r["ServerCount"]=allServer.lenght;
  r["ServerList"]=allServer.map((e)=>{return {ip:e.ip,port:e.port,id:e.id,created:e.inserted,lastContact:e.lastContact,active:e.active};});
  r["queryCount"]=allQueryResult.length;
  return r;
}

module.exports = {
  init:function(_cb){
    if(initFn)_cb();
    else initFn = _cb;
  },
  server:{
    addServer:addServer,
    getServer:getServer,
    increaseAccessCount:increaseAccessCount,
    updateLastContact:updateLastContact,
    updateServerInfo:updateServerInfo,
    getServerInfo:getServerInfo,
    getServerIpPort:getServerIpPort,
    checkServerExist:checkServerExist,
    getActiveServer:getActiveServer,
    cleanOfflineServer:cleanOfflineServer,
    reEnableServer:reEnableServer
  },
  request:{
    insertQuery:insertQuery,
    getQueries:getQueries,
    getPlayerGameTime:getPlayerGameTime,
    getPlayerOnlineHistory:getPlayerOnlineHistory
  },
  apiStatus:apiStatus
};
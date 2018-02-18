const gamedig = require("gamedig");
const db = require("./db.js");

function doQuery(id,_cb){
  var con = db.server.getServerIpPort(id);
  gamedig.query({
    type:"minecraftpe",
    host:con.ip,
    port:con.port
  }).then(function(state){
    db.request.insertQuery(id,{
      playerCount:state.raw.numplayers,
      players:state.players.map((e)=>{return e.name;})
    });
    db.server.updateLastContact(id);
    db.server.updateServerInfo(id,state.raw);
    _cb();
  }).catch(function(err){
    //NOTHING?
    _cb(err);
  });
}

function testQuery(ip,port,_cb){
  gamedig.query({
    type:"minecraftpe",
    host:ip,
    port:port
  }).then(function(state){
    _cb(null,state);
  }).catch(function(err){
    _cb(err);
  });
}

module.exports = {
  doQuery:doQuery,
  testQuery:testQuery
};
process.chdir(__dirname);
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const fs = require("fs");
const db = require("./modules/db.js");
const mcping = require("./modules/mcping.js");
const cronjob = require("./modules/cronjob.js");

const app = express();

app.use(cors());
app.use(bodyParser.json());

function sendJson(res,obj){
  res.status(200);
  res.type("application/json");
  res.send(JSON.stringify(Object.assign(obj,{error:false})));
  res.end();
}

function sendError(res,err){
  res.status(400);
  res.type("application/json");
  res.send(JSON.stringify({"error":true,"message":err.message}));
  res.end();
}

function init(){

  app.use(express.static("frontend/"));

  app.get("/embed/:serverId.js",(req,res)=>{
    if(db.server.getServer(req.params.serverId)){
      fs.readFile("./client-script.js",(err,file)=>{
        if(err){
          res.status(500).type("text/javascript").send("\"FATAL ERROR GENERATING SCRIPT!\";").end();
        }
        else{
          res.status(200);
          res.type("text/javascript");
          res.send(file.toString().replace("%@SERVERID@%",req.params.serverId));
          res.end();
        }
      });
    }
    else{
      res.status(500).type("text/javascript").send("\"INVALID SERVER ID!\";").end();
    }
  });

  app.get("/api/apiStatus",(req,res)=>{
    sendJson(res,db.apiStatus());
  });

  app.get("/api/:serverId/serverInfo",(req,res)=>{
    var info = db.server.getServerInfo(req.params.serverId);
    if(info){
      db.server.increaseAccessCount(req.params.serverId);
      sendJson(res,info);
    }
    else{
      sendError(res,new Error("Invalid Server ID!"));
    }
  });

  app.get("/api/:serverId/queryResults",(req,res)=>{
    sendError(res,new Error("ACTION DUE TO HIGH TRAFFIC DISABLED!"));return;
    var info = db.request.getQueries(req.params.serverId);
    if(info){
      db.server.increaseAccessCount(req.params.serverId);
      sendJson(res,{results:info});
    }
    else{
      sendError(res,new Error("Invalid Server ID!"));
    }
  });

  app.get("/api/:serverId/onlineHistory/:timespan?",(req,res)=>{
    if(db.server.getServer(req.params.serverId)){
      db.server.increaseAccessCount(req.params.serverId);
      if(req.params.timespan){
        if(req.params.timespan=="today"){
          sendJson(res,{result:db.request.getPlayerOnlineHistory(req.params.serverId,1)});
        }
        else if(req.params.timespan=="week"){
          sendJson(res,{result:db.request.getPlayerOnlineHistory(req.params.serverId,2)});
        }
        else if(req.params.timespan=="month"){
          sendJson(res,{result:db.request.getPlayerOnlineHistory(req.params.serverId,3)});
        }
        else{
          sendError(res,new Error("Invalid timespan!"));
        }
      }
      else{
        //TIMESPAN=0;
        var data = db.request.getPlayerOnlineHistory(req.params.serverId,0);
        sendJson(res,{result:data});
      }
    }
    else{
      sendError(res,new Error("Invalid Server ID!"));
    }
  });

  app.get("/api/:serverId/playerGameTime/:timespan?",(req,res)=>{
    if(db.server.getServer(req.params.serverId)){
      db.server.increaseAccessCount(req.params.serverId);
      if(req.params.timespan){
        if(req.params.timespan=="today"){
          sendJson(res,{result:db.request.getPlayerGameTime(req.params.serverId,1)});
        }
        else if(req.params.timespan=="week"){
          sendJson(res,{result:db.request.getPlayerGameTime(req.params.serverId,2)});
        }
        else if(req.params.timespan=="month"){
          sendJson(res,{result:db.request.getPlayerGameTime(req.params.serverId,3)});
        }
        else{
          sendError(res,new Error("Invalid timespan!"));
        }
      }
      else{
        //TIMESPAN=0; -> TODAY
        sendJson(res,{result:db.request.getPlayerGameTime(req.params.serverId,1)});
      }
    }
    else{
      sendError(res,new Error("Invalid Server ID!"));
    }
  });
  app.get("/api/:serverId/playerOnline",(req,res)=>{
    if(db.server.getServer(req.params.serverId)){
      db.server.increaseAccessCount(req.params.serverId);
      sendJson(res,{onlineList:db.request.getPlayerGameTime(req.params.serverId,0)});
    }
    else{
      sendError(res,new Error("Invalid Server ID!"));
    }
  });

  app.get("/api/:serverId*",(req,res)=>{
    sendError(res,new Error("Please specify an action!"));
  });

  app.get("/api",(req,res)=>{
    sendError(res,new Error("Please specify a Server ID!"));
  });

  app.post("/api/insertServer",(req,res)=>{
    console.log(req.body);
    if(req.body.ip&&req.body.port){
      var exi=db.server.checkServerExist(req.body.ip,req.body.port);
      if(exi){
        if(exi.active){
          sendError(res,new Error("This server already exists! ID: "+exi.id));
        }
        else{
          reEnableServer(exi.id);
          sendJson(res,{status:"ENABLED",serverId:exi.id,info:"Server enabled again!"});
        }
      }
      else{
        mcping.testQuery(req.body.ip,req.body.port,(err,status)=>{
          if(err){
            sendError(res,new Error("Can't reach Server! Please make sure your server is online!"));
          }
          else{
            var id=db.server.addServer(req.body.ip,req.body.port);
            sendJson(res,{status:"OK",serverId:id});
          }
        });
      }
    }
    else{
      sendError(res,new Error("Please specify server IP and PORT"));
    }
  });

  cronjob.startCronjob();

  app.listen(8010);

  console.log(db.server.getActiveServer().length+" Active Servers loaded");

}

db.init(init);
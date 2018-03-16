const express = require("express");
const http = require("http");
const helmet = require("helmet");
const bodyParser = require("body-parser");
const cors = require("cors");
const moment = require("moment");

const ApiDatabase=require("./db.js").ApiDatabase;
const BannerDatabase = require("./db.js").BannerDatabase;
const QueryLib = require("./query.js").Query;

class WebServer{
    constructor(config){
        this.config = {
            "host":config.host||"0.0.0.0",
            "port":config.port||80,
            "mongoConnection":config.mongoConnection||null,
            "useStructuredJson":config.jsonStructured||false,
            "mongoDb":config.mongoDb||"mcstat"
        };
        this.app = new express();
        this.server = http.createServer(this.app);
    }

    start(){
        return new Promise((_resolve,_reject)=>{
            this.server.listen(this.config.port,this.config.host,()=>{
                _resolve(this);
            });
        });
    }
    close(){
        if(this.server&&this.server.listening){
            this.server.close();
        }
        else{
            throw new Error("Server not listening!");
        }
    }
    _sendError(res,error,code=null){
        console.error(error)
        var status = 500;
        if(code!==null){
            error = new Error(error);
            error.code=code;
            status=400;
        }
        res
        .status(status)
        .type("application/json")
        .send(JSON.stringify({"error":true,"message":error.toString(),"code":error.code}))
        .end();
    }
    _sendJson(res,data){
        data=Object.assign(data,{error:false,generated:new Date()});
        res
        .status(200)
        .type("application/json")
        .send(this.config.useStructuredJson?JSON.stringify(data,null,2):JSON.stringify(data))
        .end();
    }
    registerMiddleware(){
        //TODO: LATER WITH X-POWEREDBY this.app.use(helmet());
        this.app.use(bodyParser.json({extended:true}));
        this.app.use(cors());
    }
}

class ApiServer extends WebServer{
    constructor(...args){
        super(...args);
        this.db=new ApiDatabase(this.config.mongoConnection,this.config.mongoDb);
    }
    start(){
        return new Promise(async (_resolve,_reject)=>{
            try{
                await this.db.connect();
                await this.db.loadDatabaseStructure();
                await super.start();
                _resolve(this);
            }
            catch(ex){
                _reject(ex);
            }
        });
    }
    close(){
        super.close();
        if(this.db&&this.db.isConnected()){
            this.db.close();
        }
    }
    _f0(x){
        return x<10?"0"+x:x;
    }
    _formatDate(x){
        var d = new Date(x);
        return d.getFullYear()+"-"+this._f0(d.getMonth()+1)+"-"+this._f0(d.getDate())+" "+this._f0(d.getHours())+":"+this._f0(d.getMinutes())+":"+this._f0(d.getSeconds());
    }

    registerListener(){
        //FIXED TO THIS CLASS
        return new Promise((_resolve,_reject)=>{
            //TODO: ADD MIDDLEWARES...
            super.registerMiddleware();
            //ROUTES 
            this.app.post("/insertServer",this._insertServerHandler.bind(this));
            this.app.get("/getServerInfo/:serverId",this._serverInfoHandler.bind(this));
            this.app.get("/getLastQuery/:serverId",this._getLastQueryHandler.bind(this));
            this.app.get("/getOnlineHistory/:serverId/:duration?",this._getOnlineHistoryHandler.bind(this));
            this.app.get("/getPlayerMinuteCount/:serverId/:duration?",this._getPlayerMinuteCountHandler.bind(this));

            //for Testing purpose...
            this.app.get("/ping",this._pingHandler.bind(this));

            _resolve();
        });
    }
    _pingHandler(req,res){
        if(this.db.isConnected()){
            this._sendJson(res,{foo:"bar"});
        }
        else{
            this._sendError(res,new Error("Database not connected!"));
        }
    }
    async _insertServerHandler(req,res){
        //ERROR CODES:
        /*
            1: Field missing (serverHost,serverPort)
            2: Server not reachable
            3: Server already Exist
            4: Server enabled again..
        */
        var host = req.body.serverHost;
        var port = req.body.serverPort;

        if(host&&port){
            try{
                var existingServer = await this.db.getServerByIpAndPort(host,port);
                if(existingServer){
                    if(existingServer.enabled){
                        this._sendError(res,new Error("Server already exists! ID: "+existingServer.serverId+", added: "+this._formatDate(existingServer.created)),3);
                    }
                    else{
                        await this.db.reEnableServer(existingServer.serverId);
                        this._sendError(res,new Error("Server enabled again. ID: "+existingServer.serverId+", disabled on: "+this._formatDate(existingServer.disableTimestamp)),4);
                    }
                }
                else {
                    var result = await QueryLib.getServerQuery(host,port);
                    var serverId = await this.db.insertNewServer(host,port,{motd:result.motd,maxPlayerCount:result.maxPlayerCount,serverVersion:result.serverVersion,plugins:result.plugins});
                    this._sendJson(res,{status:"OK","serverId":serverId});
                }
            }
            catch(ex){
                if(ex.code==112){
                    this._sendError(res,new Error("Server not Reachable!"),2);
                }
                else{
                    this._sendError(res,ex);
                }
            }
        }
        else{
            this._sendError(res,new Error("Missing Parameters! serverHost and serverPort required!"),1);
        }
    }

    async _serverInfoHandler(req,res){
        try{
            var serverId = req.params.serverId;
            var server = await this.db.getServer(serverId);
            if(server){
                delete server._id;
                this._sendJson(res,server);
            }
            else{
                this._sendError(res,new Error("Invalid ServerID!"),1);
            }
        }
        catch(ex){
            this._sendError(res,ex);
        }
    }

    async _getLastQueryHandler(req,res){
        try{
            var serverId = req.params.serverId;
            var lastQuery = await this.db.getLastQuery(serverId);
            if(lastQuery){
                delete lastQuery._id;
                this._sendJson(res,lastQuery);
            }
            else{
                this._sendError(res,new Error("No Query yet.. Please wait a few minutes!"),1)
            }
        }
        catch(ex){
            this._sendError(res,ex);
        }
    }

    _getPastDateForQuery(value,oDate){
        var m = oDate?oDate:new Date();
        var sinceDate = moment(m).subtract(1,"day").toDate();
        switch(value){
            case "month":
                sinceDate=moment(m).subtract(1,"month").toDate();
                break;
            case "day":
                sinceDate=moment(m).subtract(1,"day").toDate();
                break;
            case "hour":
                sinceDate=moment(m).subtract(1,"hour").toDate();
                break;
            default:
                sinceDate=moment(m).subtract(1,"day").toDate();
        }
        return sinceDate;
    }

    async _getOnlineHistoryHandler(req,res){
        try{
            var queryDate = this._getPastDateForQuery(req.params.duration);
            var queries = await this.db.getQueriesUntilToday(req.params.serverId,queryDate);
            var historyResult=queries.map((x)=>{return {timestamp:x.timestamp,playerCount:x.playerCount};});
            this._sendJson(res,{playerData:historyResult});
        }
        catch(ex){
            this._sendError(res,ex);
        }
    }

    //WHEN THE USER IS MORE THAN 7.5 MINUTES NOT RECORDED, HE'S SUPPOSED TO BE OFFLINE...
    _checkDurationIsInRealisticRange(last,akt){
        if(akt-last>this.config.queryInterval*1.5){
            return false;
        }
        return true;
    }

    //TODO: THIS FUNCTION NEEDS FURTHER TESTING IF WORKING LIKE PREDICTED...
    async _getPlayerMinuteCountHandler(req,res){
        try{
            var queryDate = this._getPastDateForQuery(req.params.duration);
            var queries = await this.db.getQueriesUntilToday(req.params.serverId,queryDate);
            var playerHourCounter = {};
            //FOR SHOULD BE FASTER... 
            for(var i=0;i<queries.length;i++){
                for(var j=0;j<queries[i].playerList.length;j++){
                    if(playerHourCounter.hasOwnProperty(queries[i].playerList[j])){
                        //IF USER IN RANGE
                        if(this._checkDurationIsInRealisticRange(playerHourCounter[queries[i].playerList[j]].lastCheck,queries[i].timestamp)){
                            //ADD COUNTER+SET NEW DATE
                            playerHourCounter[queries[i].playerList[j]].count+=queries[i].timestamp-playerHourCounter[queries[i].playerList[j]].lastCheck;
                            playerHourCounter[queries[i].playerList[j]].lastCheck=queries[i].timestamp;
                        }
                        else{
                            //ELSE: ONLY SET NEW DATE
                            playerHourCounter[queries[i].playerList[j]].lastCheck=queries[i].timestamp;
                        }
                    }
                    else{
                        //CREATE USER IN OBJECT..
                        playerHourCounter[queries[i].playerList[j]]={
                            count:0,
                            lastCheck:queries[i].timestamp
                        };
                    }
                }
            }
            //TRANSFORM AND SORT ARRAY
            var playerNameCounterArray = Object.keys(playerHourCounter).map((x)=>{playerHourCounter[x].count=Math.round(playerHourCounter[x].count/(1000*60)); return Object.assign(playerHourCounter[x],{playerName:x});}).sort((a,b)=>{return b.count-a.count;});
            this._sendJson(res,{playerData:playerNameCounterArray});
        }
        catch(ex){
            this._sendError(res,ex);
        }
    }
    

}

module.exports = {
    WebServer:WebServer,
    ApiServer:ApiServer
}
const express = require("express");
const http = require("http");
const helmet = require("helmet");
const bodyParser = require("body-parser");

const ApiDatabase=require("./db.js").ApiDatabase;
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
        var status = 500;
        if(code!==null){
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
            this.app.use(helmet());
            this.app.use(bodyParser.json({extended:true}));
            //ROUTES 
            this.app.get("/insertServer",this._insertServerHandler.bind(this));

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
                    var result = await QueryLib.getServerQuery(host,port);
                    var serverId = await this.db.insertNewServer(host,port,{motd:result.motd,maxPlayerCount:result.maxPlayerCount,serverVersion:result.serverVersion,plugins:result.plugins});
                    this._sendJson(res,{status:"OK","serverId":serverId});
                }
                else {
                    if(existingServer.enabled){
                        this._sendError(res,new Error("Server already exists! ID: "+existingServer.serverId+", added: "+this._formatDate(existingServer.created)),3);
                    }
                    else{
                        await this.db.reEnableServer(existingServer.serverId);
                        this._sendError(res,new Error("Server enabled again. ID: "+existingServer.serverId+", disabled on: "+this._formatDate(existingServer.disableTimestamp)),4);
                    }
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
    

}

module.exports = {
    WebServer:WebServer,
    ApiServer:ApiServer
}
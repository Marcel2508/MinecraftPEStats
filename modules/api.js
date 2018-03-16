const express = require("express");
const http = require("http");
const ApiDatabase=require("./db.js").ApiDatabase;

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
    _sendError(res,error){
        res
        .status(500)
        .type("text/plain")
        .send(error.toString())
        .end();
    }
    _sendJson(res,data){
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
    registerListener(){
        //FIXED TO THIS CLASS
        return new Promise((_resolve,_reject)=>{
            //OWN 
            this.app.get("/ping",this._pingHandler.bind(this));

            _resolve();
        });
    }
    _pingHandler(req,res){
        if(this.db.isConnected()){
            this._sendJson(res,{error:false,foo:"bar"});
        }
        else{
            this._sendError(res,new Error("Database not connected!"));
        }
    }
    

}

module.exports = {
    WebServer:WebServer,
    ApiServer:ApiServer
}
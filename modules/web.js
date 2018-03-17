const path = require("path");
const express = require("express");
const api = require("./api.js");
const McStatDatabase = require("./db.js").McstatDatabase;
const fs = require("fs");

//FOR JS FILES OR THE FRONTEND..
class Web extends api.WebServer{
    //REQUIRES apiServerUrl entry in config!
    constructor(...args){
        super(...args);
        /*NOT NEEDED FOR NOW.. if(this.config.databaseConnection){
            //USE OPEN DATABSE CONNECTION...
            this.db = this.config.databaseConnection;
        }
        else{
            this.db=new McStatDatabase(this.config.mongoConnection,this.config.mongoDb);
        }*/
    }

    registerListener(){
        //FIXED TO THIS CLASS
        return new Promise((_resolve,_reject)=>{
            //TODO: ADD MIDDLEWARES...
            super.registerMiddleware();
            //ROUTES 
            this.app.use(express.static(path.join(__dirname,"..","htdocs")));

            this.app.get("/embed/:serverId.js",this._serverIntegrationJsHandler.bind(this));
            _resolve();
        });
    }
    _serverIntegrationJsHandler(req,res){
        fs.readFile(path.join(__dirname,"web","inject.js"),(err,fileData)=>{
            if(err){
                this._sendError(res,err);
            }
            else{
                fileData = fileData.toString().replace(/%@SERVERID@%/gim,"").replace(/%@SERVERURL@%/gim,this.config.apiServerUrl);
                res.status(200)
                .type("text/javascript")
                .send(fileData)
                .end();
            }
        });
    }
}

module.exports={
    Web:Web
};
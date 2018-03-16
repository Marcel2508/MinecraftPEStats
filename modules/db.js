const mongo = require("mongodb").MongoClient;
const uniqid = require("uniqid");
class Database{
    constructor(server_url,db){
        this.serverUrl = server_url;
        this.connection=null;
        this.dbName = db||"mcstat";
        if(!this.serverUrl)throw new Error("Mongo Server Url required!");
    }
    connect(){
        return new Promise((_resolve,_reject)=>{
            if(this.isConnected()){
                _reject(new Error("Server already connected!"));
            }
            else{
                mongo.connect(this.serverUrl,(err,client)=>{
                    if(err){
                        _reject(err);
                    }
                    else{
                        this.connection=client;
                        this.db=this.connection.db(this.dbName);
                        _resolve(this);
                    }
                });
            }
        });
    }
    _getOrCreateCollection(colName){
        return new Promise((_resolve,_reject)=>{
            var col = this.db.collection(colName);
            if(col){
                _resolve(col);
            }
            else{
                this.db.createCollection(colName,(err)=>{
                    if(err){
                        _reject(err);
                    }
                    else{
                        col.createIndex({serverId:1},(err)=>{
                            if(err2){
                                _reject(err2);
                            }
                            else{
                                col=this.db.collection(colname);
                                _resolve(col);
                            }
                        })
                    }
                });
            }
        });
    }
    close(){
        if(this.isConnected()){
            this.connection.close();
        }
        else{
            throw new Error("Server not connected!");
        }
    }
    isConnected(){
        if(this.connection&&this.connection.isConnected())return true;
        else return false;
    }
}

class McstatDatabase extends Database{
    constructor(...args){
        super(...args);
    }
    loadDatabaseStructure(){
        return new Promise(async (_resolve,_reject)=>{
            try{
                this.serverCollection = await this._getOrCreateCollection("server");
                this.queryCollection  = await this._getOrCreateCollection("queries");
                this.statusCollection = await this._getOrCreateCollection("status");
                _resolve();
            }
            catch(ex){
                _reject(ex);
            }
        });
    }
    getServer(serverId){
        return new Promise((_resolve,_reject)=>{
            
        });
    }
}

class ApiDatabase extends McstatDatabase{
    constructor(...args){
        super(...args);
    }
    insertNewServer(serverHost,serverPort,serverInfoObject){
        return new Promise((_resolve,_reject)=>{
            var nid= uniqid();
            this.serverCollection.insertOne({
                serverId:nid,
                ip:serverHost,
                port:serverPort,
                created:new Date(),
                serverInfo:serverInfoObject,
                lastContact:null,
                lastApiRequest:null,
                lastBannerRequest:null,
                webOrigins:[],
                active:true,
                disableTimestamp:null
            },(err)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve(nid);
                }
            });
        });
    }
}

class QueryDatabase extends McstatDatabase{
    constructor(...args){
        super(...args);
    }
    //DB APIS:
    getActiveServer(){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.find({"active":true}).toArray((err,res)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve(res);
                }
            });
        });
    }
    insertQuery(queryResult){
        return new Promise((_resolve,_reject)=>{
            this.queryCollection.insertOne(queryResult,(err)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve();
                }
            });
        });
    }
    setServerDisabled(serverId){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.updateOne({"serverId":serverId},{"$set":{"enabled":false,"disableTimestamp":new Date()}},(err)=>{
                if(err){
                    _reject(err);
                }
                else{
                    _resolve();
                }
            });
        });
    }
    updateServerLastContact(serverId){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.updateOne({"serverId":serverId},{"$set":{"lastContact":new Date()}},(err)=>{
                if(err){
                    _reject(err)
                }
                else{
                    _resolve();
                }
            })
        });
    }
    updateServerInfoAndLastContact(serverId,serverInfoObject){
        return new Promise((_resolve,_reject)=>{
            this.serverCollection.updateOne({"serverId":serverId},{"$set":{"lastContact":new Date(),"serverInfo":serverInfoObject}},(err)=>{
                if(err){
                    _reject(err)
                }
                else{
                    _resolve();
                }
            })
        });
    }
}

module.exports = {
    Database:Database,
    McstatDatabase:McstatDatabase,
    ApiDatabase:ApiDatabase,
    QueryDatabase:QueryDatabase
}
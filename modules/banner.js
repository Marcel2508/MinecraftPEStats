const pureImage = require("pureimage");
const BannerDatabase = require("./db.js").BannerDatabase;
const webServerBaseClass = require("./api.js").WebServer;

class BannerServer extends WebServer{
    constructor(...args){
        super(...args);
        this.db=new BannerDatabase(this.config.mongoConnection,this.config.mongoDb);
    }
    _loadResource(filename){
        return new Promise((_resolve,_reject)=>{
            //TODO: STOPPED HERE YESTERDAY...
        });
    }
    start(){
        return new Promise(async (_resolve,_reject)=>{
            try{
                await this.db.connect();
                await this.db.loadDatabaseStructure();
                await super.start();
                this.resource = await Promise.all(this._loadResource("bg.jpg"),this._loadResource("dot-on.jpg"),this._loadResource("dot-off.jpg"),this._loadFont("Minecraft.ttf"));
                _resolve();
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
    async _bannerRoutHandler(req,res){

    }

}
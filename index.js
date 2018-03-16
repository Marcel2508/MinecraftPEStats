const ApiServer = require("./modules/api.js");
const QueryTask = require("./modules/query.js");

const api = new ApiServer.ApiServer({
    "port":8080,
    "mongoConnection":"mongodb://localhost:27017",
    "mongoDb":"mcstat",
    "queryInterval":360000
});

const queryTask = new QueryTask.Query({
    "interval":360000,
    "statusInterval":21600000,
    "timeout":3000,
    "mongoConnection":"mongodb://localhost:27017",
    "mongoDb":"mcstat",
    "setDisabledTimeout":24*60*60*1000,
    "setDisabledWebTimeout":72*60*60*1000
}); 

const run = async function run(){
    try{
        await api.start();
        await api.registerListener();
        console.log("API STARTED!");
        await queryTask.start();
        console.log("Query Task started!")

    }
    catch(ex){
        console.error("ERROR STARTING API:");
        console.error(ex);
    }
}
run();
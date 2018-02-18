const gamedig = require("gamedig");

gamedig.query({
  type:"minecraftpe",
  host:"grandtheft.mcpe.me",
  port:"19132"
}).then(function(state){
  console.log(state);
}).catch(function(err){
  console.error(err);
});
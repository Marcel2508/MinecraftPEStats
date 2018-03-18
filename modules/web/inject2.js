(function(){
    //HELPER FUNCTIONS:
    //SOURCE: https://stackoverflow.com/a/6234804
    var escapeHtml = function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    };
    var d0 = function d0(x){
        return x<10?"0"+x:x;
    };
    var formatDate = function escapeHtml(timestamp,timespan){
        var d=new Date(timestamp);
        switch(timespan.toLowerCase()){
            case "hour":
            case "day":
                return d0(d.getHours())+":"+d0(d.getMinutes());
            default:
                return d.getFullYear()+"-"+d0(d.getMonth()+1)+"-"+d0(d.getDate())+" "+d0(d.getHours())+":"+d0(d.getMinutes());
        }
    };
    
    var SERVER_ID = "%@SERVERID@%";
    var SERVER_URL = "%@SERVERURL@%";
    window.mcstats = {};
    
    var apiRequest = function apiRequest(requestUrl,_callback){
        var request = new XMLHttpRequest();
        request.open("GET",SERVER_URL+"/api/"+requestUrl);
        request.addEventListener('load', function(event) {
            if (request.status >= 200 && request.status < 300) {
                _callback(null,JSON.parse(request.responseText));
            } else {
                _callback(request.status);
            }
        });
        request.send();
    };

    var formatMinutes = function formatMinutes(minutes){
        if(minutes<60){
            return d0(minutes)+" M";
        }
        else{
            var h = Math.floor(minutes/60);
            var m = minutes%60;
            return d0(h)+":"+d0(m)+" H";
        }
    };

    //CALL IT LIKE: makeTable("myContainer","day",function(){..},function(){..},function(){...});
    window.mcstats.makeTable = function makeTable(target,timespan,minuteFormatFunction,dateFormatFunction,_callback){
        if(!timespan)timespan="day";
        if(!dateFormatFunction)dateFormatFunction=formatDate;
        if(!minuteFormatFunction)minuteFormatFunction=formatMinutes;
        if(typeof target=="string")target=document.getElementById(target);
        if(!target){
            console.warn("[MCSTATS] No valid DOM target specified. Please make sure to call this function after defining the target element.");
            return _callback(new Error("[MCSTATS] No valid DOM target specified. Please make sure to call this function after defining the target element."));
        }

        //get Data
        apiRequest("getPlayerMinuteCount/"+SERVER_ID+"/"+timespan,(err,result)=>{
            if(err){
                console.warn("[MCSTATS] Can't connect to API Server!");
                console.warn(err);
                return _callback(err);
            }
            //rendering
            target.innerHTML="";
            var table = document.createElement("table");
            table.setAttribute("class","mcstats-table mcstats-timespan-"+escapeHtml(timespan));
            table.innerHTML= "<thead><tr><th class='mcstats-title-playername'>Playername</th><th class='mcstats-title-playedtime'>Time played</th><th class='mcstats-title-lastonline'>Last online</th></thead><tbody></tbody>";
            var tbody = table.getElementsByTagName("tbody")[0]; 
            var tbodyContentBuffer = "";
            result.playerData.forEach((row)=>{
                tbodyContentBuffer+="<tr><td class='mcstats-body-playername'>"+escapeHtml(row.playerName)+"</td><td class='mcstats-body-playedtime'>"+escapeHtml(minuteFormatFunction(row.count))+"</td><td>"+escapeHtml(dateFormatFunction(row.lastOnline))+"</td></tr>";
            });
            tbody.innerHTML=tbodyContentBuffer;
            target.appendChild(table);
            if(_callback)_callback();
        });
    };


    window.mcstats.makeChart = function makeChart(target,timespan,_callback){
        if(!timespan)timespan="day";
        if(typeof target=="string")target=document.getElementById(target);
    };
})();
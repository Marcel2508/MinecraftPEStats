(function(){
  var API_SERVER="https://mcstat.sol4it.de";
  var SERVER_ID = "%@SERVERID@%";

  var _makeRequest = function _makeRequest(apiurl,_cb){
    var request = new XMLHttpRequest();
    request.open("GET",API_SERVER+"/api/"+apiurl);
    request.addEventListener('load', function(event) {
      if (request.status >= 200 && request.status < 300) {
        _cb(null,JSON.parse(request.responseText));
      } else {
        _cb(request.status);
      }
    });
    request.send();
  };

  var _l0 = function _l0(i){
    if(i<10)return "0"+i;
    else return i;
  };
  var _formatLastSeen = function _formatLastSeen(ts){
    var d= new Date(ts);
    return _l0(d.getDate())+"-"+_l0(d.getMonth()+1)+"-"+d.getFullYear();
  };

  var _formatTitle = function _formatTitle(ts){
    if(ts=="today")return "today";
    if(ts=="week")return "this week";
    if(ts=="month")return "this month";
  };

  var makePlayerList = function initPlayerList(elem,timespan,limit){
    if(limit===undefined)limit=10;
    if(timespan===undefined)timespan="today";
    if(typeof elem === "string"){elem = document.getElementById(elem);}

    if(elem&&elem.tagName.toLowerCase()=="table"){
      var tBody = null;
      var tHead = null;
      if(!elem.tHead){
        var _th = document.createElement("thead");
        _th.className="table-head";
        elem.appendChild(_th);
      }
      tHead=elem.tHead;
      if(!elem.tBodies.length>0){
        var _tb = document.createElement("tbody");
        _tb.className="table-body";
        elem.appendChild(_tb);
      }
      tBody=elem.tBodies[0];
      elem.classList.add("playerlist-table");
      elem.classList.add(timespan);
      tBody.innerHTML="";
      tHead.innerHTML="";

      //ALL SETUP DONE...

      _makeRequest(SERVER_ID+"/playerGameTime/"+timespan,function(err,res){
        if(err){
          console.error(new Error("[MCAPI] ERROR WHILE GETTING PLAYER LIST!"));
        }
        else{
          var _hrowT = document.createElement("tr");
          _hrowT.innerHTML="<th colspan=\"3\" style=\"text-align:center;\">Top players "+_formatTitle(timespan)+"</th>";
          _hrowT.className="table-head-row-title";
          tHead.appendChild(_hrowT);
          var _hrow = document.createElement("tr");
          _hrow.innerHTML="<th>Playername</th><th>Played minutes</th><th>Last seen</th>";
          _hrow.className="table-head-row";
          tHead.appendChild(_hrow);

          //QUERY OK. GENERATE TABLE
          var list = res.result;
          list.forEach(function(pl,i){
            if(i<limit){
              //ADD ROW
              var _row = document.createElement("tr");
              _row.innerHTML="<td>"+pl.userName+"</td><td>"+pl.minuteCount+"</td><td>"+_formatLastSeen(pl.lastSeen)+"</td>";
              _row.className="table-data-row";
              tBody.appendChild(_row);
            }
          });

        }
      });

    }
    else{
      console.error(new Error("[MCAPI] Element must be type of table!"));
    }
  };


  var makeOnlineChart = function makeOnlineChart(elem,timespan){
    if(timespan===undefined)timespan="today";
    if(typeof elem === "string"){elem = document.getElementById(elem);}

    var _next = function _next(){
      if(elem&&elem.tagName.toLowerCase()=="svg"){
        //ALL SETUP DONE...
  
        _makeRequest(SERVER_ID+"/onlineHistory/"+timespan,function(err,res){
          if(err){
            console.error(new Error("[MCAPI] ERROR WHILE GETTING PLAYER LIST!"));
          }
          else{
            //GENERATE CHART...
            nv.addGraph(function(){
              var chart = nv.models.lineChart()
                .useInteractiveGuideline(true)
                .showLegend(true)
                .showYAxis(true)
                .showXAxis(true);
              if(timespan=="today"){
                chart.xAxis
                .axisLabel('Date')
                .tickFormat(function(d) { return d3.time.format('%H:%M')(new Date(d)); });
              }
              else{
                chart.xAxis
                .axisLabel('Date')
                .tickFormat(function(d) { return d3.time.format('%b %d')(new Date(d)); });
              }

              chart.yAxis 
                .axisLabel("Player Count");
              
              d3.select(elem)
                .datum([
                  {
                    values:res.result.map(function(e){return {x:e.timestamp,y:e.count};}),
                    color:"#0000FF",
                    key:"Player count"
                  }
                ])
                .transition().duration(500)
                .call(chart);
              return chart;
            });

          }
        });
      }
      else{
        console.error(new Error("[MCAPI] Element must be type of SVG!"));
      }
    };

    //ADD CHART LIB IF NOT PRESENT
    if(!window.nv&&!window.d3){
      var s1 = document.createElement("script");
      s1.type = "text/javascript";
      s1.src = "https://cdnjs.cloudflare.com/ajax/libs/d3/3.5.3/d3.min.js";
      var css1 = document.createElement("link");
      css1.setAttribute("href","https://cdnjs.cloudflare.com/ajax/libs/nvd3/1.8.6/nv.d3.min.css");
      css1.setAttribute("type","text/css");
      css1.setAttribute("rel","stylesheet");
      document.head.appendChild(css1);
      s1.onload=function(){
        var s2 = document.createElement("script");
        s2.type = "text/javascript";
        s2.src = "https://cdnjs.cloudflare.com/ajax/libs/nvd3/1.8.6/nv.d3.min.js";
        s2.onload=_next;
        document.head.appendChild(s2);
      };
      document.head.appendChild(s1);
    }
    else _next();
  };

  var getServerInfo = function getServerInfo(_callback){
    _makeRequest(SERVER_ID+"/serverInfo",function(err,res){
      if(err){
        _callback(err);
      }
      else{
        _callback(null,res);
      }
    });
  };

  window.mcPlayerStats={makePlayerList:makePlayerList,makeOnlineChart:makeOnlineChart,getServerInfo:getServerInfo};

})();
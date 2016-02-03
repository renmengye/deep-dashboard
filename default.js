Array.min = function(array) {
  return Math.min.apply(Math, array);
};

Array.max = function(array ) {
  return Math.max.apply(Math, array);
};

var getSearchParameters = function() {
      var prmstr = window.location.search.substr(1);
      return prmstr != null && prmstr != "" ? transformToAssocArray(prmstr) : {};
}

var transformToAssocArray = function(prmstr) {
    var params = {};
    var prmarr = prmstr.split("&");
    for ( var i = 0; i < prmarr.length; i++) {
        var tmparr = prmarr[i].split("=");
        params[tmparr[0]] = tmparr[1];
    }
    return params;
}

var allPanels = {};

// Choose between step and time.
var xKey = "step";
var xKeyFormat = "";
if (xKey === "step") {
  xKeyFormat = ",d";
} else {
  xKeyFormat = "";
}

var timeOpt = "absolute"
var rootFolder = "../results/"

var getSubsampleRate = function(len) {
  if (len < 500) {
    return 1;
  } else {
    return Math.floor(len / 500);
  }
}

// Parse CSV data.
var parseData = function(csvData) {
  // Look up the data key.
  var yKey = "";
  for (var key in csvData[0]) {
    if (key !== "step" && key !== "time") {
      yKey = key;
      break;
    }
  }

  var subsample = getSubsampleRate(csvData.length);
  var displayValues = [];
  for (var ii = 0; ii < csvData.length; ++ii) {
    if (ii % subsample == 0) {
      displayValues.push({
        "x": csvData[ii][xKey],
        "y": csvData[ii][yKey]
      })
    }
  }

  // Assemble data.
  var data = [{
                values: displayValues,
                key: yKey
              }];
  return data;
};

var getPanelId = function(filename) {
  var filenameArr = filename.split("/");
  var filename2 = filenameArr[filenameArr.length - 1];
  var filename2Arr = filename2.split(".");
  var panelId = filename2Arr[0];

  return panelId;
};

var updateChart = function(placeholder, filename) {
  var panelId = getPanelId(filename);
  var chart = allPanels[panelId];

  d3.csv(filename, function(error, csvData) {
    if (error) throw error;
    var data = parseData(csvData);
    var xValues = data[0].values.map(function(item) {return item.x});
    var yValues = data[0].values.map(function(item) {return item.y});
    chart
      .xDomain([Array.min(xValues), Array.max(xValues)])
      .yDomain([Array.min(yValues), Array.max(yValues)]);
    d3.select("#svg_" + panelId)
        .datum(data);
    chart.update();
    updateLastModified(filename, false);
  });
};

var updateLastModified = function(filename, add) {
  var panelId = getPanelId(filename);
    // Add last modified date.
  $.ajax({
      type: "GET",
      async: true,
      timeout: 5000,
      url: filename,
      dataType : "text",
      success: function(data, textStatus, request){
          var lastModified = request.getResponseHeader("Last-Modified");
          allPanels[panelId].lastModified = lastModified;
          if (add) {
            d3.select("#panel_" + panelId)
              .append("div")
              .attr("id", "ts_" + panelId)
              .attr("class", "timestamp")
              .html("Last updated: " + lastModified);
          } else {
            d3.select("#ts_" + panelId)
              .html("Last updated: " + lastModified);
          }
      },
      error: function(e) {throw e;}
  });
};

// Add a raw log panel.
var addPlainLog = function(placeholder, filename, name) {
  var panelId = getPanelId(filename);
  allPanels[panelId] = {};
  d3.select("#" + placeholder).append("h2").html(name);
  d3.select("#" + placeholder).append("div")
                      .attr("id", "panel_" + panelId)
                      .attr("class", "panel")
                      .append("textarea")
                      .attr("class", "raw_log")
                      .attr("cols", "80")
                      .attr("rows", "30")
                      .attr("id", "textarea_" + panelId)
                      .call(function() {
                        updateLastModified(filename, true);
                      });

  var update = function() {
    $.ajax({
        type: "GET",
        async: true,
        timeout: 5000,
        url: filename,
        dataType : "text",
        success: function(data, textStatus, request){
            var lastModified = request.getResponseHeader("Last-Modified");
            allPanels[panelId].lastModified = lastModified;
            lines = data.split("\n");
            // Maximum 500 lines.
            lines = lines.slice(Math.max(0, lines.length - 500));
            log = lines.join("\n")
            d3.select("#textarea_" + panelId)
              .html(log)
              .call(function() {
                updateLastModified(filename, false);
              });

            var textarea = document.getElementById("textarea_" + panelId);
            textarea.scrollTop = textarea.scrollHeight;
        },
        error: function(e) {throw e;}
    });
  };
  //update();
  setInterval(update, 5000);
}

// Add a chart.
var addChart = function(placeholder, filename, name) {
  nv.addGraph(function() {
    // Load data
    d3.csv(filename, function(error, csvData) {
      if (error) throw error;
      var data = parseData(csvData);

      // Extract y value range.
      var xValues = data[0].values.map(function(item) {return item.x});
      var yValues = data[0].values.map(function(item) {return item.y});

      // Initialize chart.
      var chart = nv.models.lineChart()
          .options({
              transitionDuration: 300,
              useInteractiveGuideline: true
          })
          .xDomain([Array.min(xValues), Array.max(xValues)])
          .yDomain([Array.min(yValues), Array.max(yValues)]);
      chart.xAxis
          .axisLabel(xKey)
          .tickFormat(d3.format(xKeyFormat));
      chart.yAxis
          .axisLabel("")
          .tickFormat(function(d) {
              if (d == null) {
                  return "N/A";
              }
              return d3.format(",.2f")(d);
          });

      var panelId = getPanelId(filename);

      d3.select("#" + placeholder)
          .append("h2")
          .html(name);
      d3.select("#" + placeholder)
          .append("div")
          .attr("id", "panel_" + panelId)
          .attr("class", "panel")
          .append("svg")
          .attr("id", "svg_" + panelId)
          .datum(data)
          .call(chart)
          .call(function() {
            updateLastModified(filename, true);
          });

      allPanels[panelId] = chart;

      setInterval(function() {
        updateChart(placeholder, filename)}, 10000);
      // nv.utils.windowResize(chart.update);
    });
  });
};

var addExperiment = function(experimentId) {
    var experimentFolder = rootFolder + experimentId + "/";
    d3.csv(experimentFolder + "catalog", function(error, csvData) {
      if (error) {
        d3.select("#content")
            .append("h1")
            .html(experimentId + " Not Found");
        throw error;
      }
      var placeholder = "exp_" + experimentId;

      // Set title.
      d3.select("#content")
          .append("div")
          .attr("id", placeholder)
          .attr("class", "experiment")
          .append("h1")
          .html(experimentId + " <a href='?id=" + experimentId + "'> &gt;&gt;</a>");
      for (var ii = 0; ii < csvData.length; ++ii) {
        var fname = experimentFolder + csvData[ii].filename;
        var name = csvData[ii].name;
        if (!csvData[ii].type) {
          csvData[ii].type = "csv";
        }
        if (csvData[ii].type === "csv") {
          addChart(placeholder, fname, name);
        }
        else if (csvData[ii].type === "plain") {
          addPlainLog(placeholder, fname, name)
        }
        
      }
    });

}

$(function(){
  var params = getSearchParameters();
  if (params.id) {
    addExperiment(params.id);
  } else {
    d3.csv(rootFolder + "catalog", function(error, csvData) {
      if (error) throw error;
      var maxToDisplay = 10;

      // TODO: sort by last modified date.
      for (var ii = 0; ii < Math.min(csvData.length, maxToDisplay); ++ii) {
        addExperiment(csvData[ii].id);
      }
    })
  }
});

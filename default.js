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

var allCharts = {};

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

  // Assemble array into x, y tuples.
  var displayValues = csvData.map(function(item) {
    return {
      "x": item[xKey],
      "y": item[yKey]
    }
  });

  // Assemble data.
  var data = [{
                values: displayValues,
                key: yKey
              }];
  return data;
};

var getChartId = function(filename) {
  var filenameArr = filename.split("/");
  var filename2 = filenameArr[filenameArr.length - 1];
  var filename2Arr = filename2.split(".");
  var chartId = filename2Arr[0];

  return chartId;
};

var updateChart = function(placeholder, filename) {
  var chartId = getChartId(filename);
  var chart = allCharts[chartId];

  d3.csv(filename, function(error, csvData) {
    if (error) throw error;
    var data = parseData(csvData);
    var xValues = data[0].values.map(function(item) {return item.x});
    var yValues = data[0].values.map(function(item) {return item.y});
    chart
      .xDomain([Array.min(xValues), Array.max(xValues)])
      .yDomain([Array.min(yValues), Array.max(yValues)]);
    d3.select("#svg_" + chartId)
        .datum(data);
    chart.update();
    updateLastModified(filename, false);
  });
};

var updateLastModified = function(filename, add) {
  var chartId = getChartId(filename);
    // Add last modified date.
  $.ajax({
      type: "GET",
      async: true,
      timeout: 5000,
      url: filename,
      dataType : "text",
      success: function(data, textStatus, request){
          var lastModified = request.getResponseHeader("Last-Modified");
          allCharts[chartId].lastModified = lastModified;
          if (add) {
            d3.select("#chart_" + chartId)
              .append("div")
              .attr("id", "ts_" + chartId)
              .attr("class", "timestamp")
              .html("Last updated: " + lastModified);
          } else {
            d3.select("#ts_" + chartId)
              .html("Last updated: " + lastModified);
          }
      },
      error: function(e) {throw e;}
  });
};

// Add a chart.
var addChart = function(placeholder, filename) {
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

      var chartId = getChartId(filename);

      d3.select("#" + placeholder)
          .append("div")
          .attr("id", "chart_" + chartId)
          .attr("class", "chart")
          .append("svg")
          .attr("id", "svg_" + chartId)
          .datum(data)
          .call(chart)
          .call(function() {
            updateLastModified(filename, true);
          });

      allCharts[chartId] = chart;

      setInterval(function() {
        updateChart(placeholder, filename)}, 5000);
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
          // .append("a")
          // .attr("href", "?id=" + experimentId)
          .html(experimentId + " <a href='?id=" + experimentId + "'> &gt;&gt;</a>");
      for (var ii = 0; ii < csvData.length; ++ii) {
        var fname = experimentFolder + csvData[ii].filename;
        addChart(placeholder, fname);
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

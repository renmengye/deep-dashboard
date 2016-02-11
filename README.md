# Deep Dashboard
A better visualization tool for training machine learning models.

## Introduction

Tired of watching un-informative commandline console?

Tired of the line limit of ssh screen?

Deep dashboard helps you visualize the training process better, and provides
with more diagnostics.

It currently supports displaying three types of visualizations:
- Time series data, in CSV format
- Raw plain text data
- Image data

### Benefits of Deep Dashboard
- Completely static, so it works in any server environment (no need to open
a new HTTP port).
- Visualizes training process in real-time.
- Allows you to check model training on any browser, laptop, cell phone, etc.
- Supports all machine learning libraries as backend.

## Installation

* Install [Apache 2](https://httpd.apache.org/docs/2.4/install.html)

For Ubuntu,
```shell
sudo apt-get install apache2
```

* Clone this repository under Apache root folder
    * It is usaully in */var/www* or */var/www/html*.
    * For Toronto users, your Apache root is */u/$USER/public_html*).

```shell
set APACHE_ROOT=/var/www/html
cd $APACHE_ROOT
git clone https://github.com/renmengye/visu.git visualizer
mkdir results
cp -R visualizer/example results
chmod -R +777 visualizer
chmod -R +777 results
```

* Alternatively, you can create soft links in the Apache folder. Note to 
Toronto users: soft links won't work in /u/username/public_html.

* Now browse [http://localhost/visualizer?id=example](http://localhost/visualizer?id=example)

## Real-time demo
This repository includes a demo for training a variational auto-encoder.
To run this demo, you will need some extra dependencies:
* [Tensorflow](https://github.com/tensorflow/tensorflow)
* numpy
* matplotlib

Now run the demo.
```shell
cd demo
python vae.py -logs $APACHE_ROOT/results
```

The command line will print the web address to visualize the training process
like below:
```
INFO: 13:59:36 vae.py:263 Dashboard: http://localhost/visualizer?id=vae_mnist-20160211135936
```

## Couple with your training program

Now you are ready to add your own job to the dashboard! This section will 
brief you through the architecture of dashboard, so you know what is going on
under the hood. In short, to add your own job, you simply need to write some
files to the right place, e.g. the training data points to a CSV file.

### File structure

- */var/www/html/*
    - *visualizer*: javascripts, css, and html.
        - *lib*
            - jquery
            - nvd3
            - d3.
        - *index.html*: Simple frontend.
        - *dashboard.js*: Main dashboard code.
        - *utils.js*: Utility functions.

    - *results*: all your experiments files
        - *catalog*: CSV file listing all the folders here.
        - *experiment_id_1*
            - *catalog*: CSV file listing all the files here.
            - *raw.log*: Plain text file to display as plain text.
            - *curve.csv*: CSV file to display as a time series curve.
            - *plot.png*: Image file to dispay as an image.
        - *experiment_id_2*
            - *catalog*
            - *raw.log*
            - *curve.csv*
            - *plot.png*

To visaulize experment_id_1, you can always go to [http://localhost/visualizer?id=experiment_id_1](http://localhost/visualizer?id=experiment_id_1)

### Frontend (javascript)

You can customize the dashboard through modifying *index.html*. The following
code is currently in *index.html* to initialie the dashboard object.

```javascript
$(function(){
    var params = getSearchParameters();
    var dashboard = new Dashboard("../results/", params.id, "#content", {
        xKey: "time",
        timeout: 5000,
        maxLines: 500,
        maxDatapoints: 500
    });
});
```

There are four arguments to initialize a new dashboard object.
- Root folder where all the experiments are stored.
- Experiment ID
- DOM selector, where to place the dashboard.
- Extra options
    - xKey: the key name for the x-axis, "step" or "time". "step" will display
    the step number, and "time" will display the absolute time.
    - timeout: automatic refresh rate, in milliseconds.
    - maxLines: maximum number of lines to display to a plain text file.
    - maxDatapoints: maximum number of data points to display in one time 
    series curve.

### Backend (your program)
Last step to hook up the dashboard is to add some lines in your training 
program.

#### Catalog format
Each experiment folder contains a *catalog* file. It is in the following CSV
format.

```csv
filename,type,name
xent1.csv,csv,training cross entropy
xent2.csv,csv,validation cross entropy
img.png, image, output
...
```

Each row contains three columns, the path to the file, the type of the file, 
and the name of the visualization. 

The type of the file can be one of the three:
- *image*
- *csv*
- *plain*

Every time you add a new visualization,
remember to register it in the catalog.

#### Adding time series visualization
1. Register in catalog.
2. Write a CSV file of the following format:

```csv
step,time,$y-axis$
0,2016-02-09T22:46:10.788732,0.886523685455
1,2016-02-09T22:46:12.329840,0.884593292039
...
```

Replace $y-axis$ with the name of the y-axis.

#### Add plain text visualization
1. Register in catalog.
2. Write a plain text file of any content.

#### Add image visualization
1. Register in catalog.
2. Write a image file.

Once you update the files existing in the catalog, the dashboard will soon 
refresh to the newest version of the file.

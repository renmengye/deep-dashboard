"""
This code implements VAE (Variational Autoencoder) [1] on MNIST.

Author: Mengye Ren (mren@cs.toronto.edu)

Usage: python vae_mnist.py -logs {path to log folder}

Reference:
[1] D.P. Kingma, M. Welling. Auto-encoding variational Bayes. ICLR 2014.
"""
import cslab_environ

import argparse
import datetime
import logger
import matplotlib
matplotlib.use('Agg')
import matplotlib.cm as cm
import matplotlib.pyplot as plt
import mnist
import numpy as np
import os
import tensorflow as tf
import time


def log_register(filename, typ, name):
    """Register a new file in the catalog

    Args:
        filename: string, path to the log file.
        typ: string, file type, "csv" or "plain" or "image".
        name: string, name of the visualization.
    """
    folder = os.path.dirname(filename)
    if not os.path.exists(folder):
        os.makedirs(folder)
    catalog = os.path.join(folder, 'catalog')
    basename = os.path.basename(filename)
    if not os.path.exists(catalog):
        with open(catalog, 'w') as f:
            f.write('filename,type,name\n')
            f.write('{},{},{}\n'.format(basename, typ, name))
    else:
        with open(catalog, 'a') as f:
            f.write('{},{},{}\n'.format(basename, typ, name))


class TimeSeriesLogger():
    """Log time series data to CSV file."""

    def __init__(self, filename, label, name=None, buffer_size=100):
        """
        Args:
            filename: string, log filename.
            label: string, y-axis label.
            name: stirng, name of the plot.
            buffer_size: string, buffer size before writing to disk.
        """
        self.filename = filename
        self.written_catalog = False
        if name is None:
            self.name = label
        else:
            self.name = name
        self.label = label
        self.buffer = []
        self.buffer.append('step,time,{}\n'.format(self.label))
        self.buffer_size = buffer_size
        log.info('Time series data "{}" log to "{}"'.format(label, filename))

    def add(self, step, value):
        """Add an entry."""
        t = datetime.datetime.utcnow()
        self.buffer.append('{:d},{},{}\n'.format(
            step, t.isoformat(), value))
        if len(self.buffer) >= self.buffer_size:
            self.flush()

    def flush(self):
        """Write the buffer to file."""

        if not self.written_catalog:
            log_register(self.filename, 'csv', self.name)
            self.written_catalog = True

        if not os.path.exists(self.filename):
            mode = 'w'
        else:
            mode = 'a'
        with open(self.filename, mode) as f:
            f.write(''.join(self.buffer))
        self.buffer = []

    def close(self):
        """Flush the rest."""
        self.flush()


def weight_variable(shape, wd=None, name=None):
    """Initialize weights."""
    initial = tf.truncated_normal(shape, stddev=0.01)
    var = tf.Variable(initial, name=name)
    if wd:
        weight_decay = tf.nn.l2_loss(var) * wd
        tf.add_to_collection('losses', weight_decay)

    return var


def get_decoder(opt, train_model, device='/cpu:0'):
    """Decoder for inference"""
    num_hid = opt['num_hid']
    nl = eval(opt['non_linear'])

    with tf.device(device):
        z = tf.placeholder('float', [None, num_hid], name='z')
        w_4 = train_model['w_4']
        b_4 = train_model['b_4']
        h_dec = nl(tf.matmul(z, w_4) + b_4, name='h_dec')
        w_5 = train_model['w_5']
        b_5 = train_model['b_5']
        mu_x = tf.sigmoid(tf.matmul(h_dec, w_5) + b_5, name='mu_x')

    return {'z': z, 'mu_x': mu_x}


def get_train_model(opt, device='/cpu:0'):
    """VAE"""
    num_inp = opt['num_inp']
    num_hid_enc = opt['num_hid_enc']
    num_hid = opt['num_hid']
    num_hid_dec = opt['num_hid_dec']
    wd = opt['weight_decay']
    nl = eval(opt['non_linear'])

    with tf.device(device):
        x = tf.placeholder('float', [None, num_inp], name='x')
        w_1 = weight_variable([num_inp, num_hid_enc], wd=wd)
        b_1 = weight_variable([num_hid_enc], wd=wd)
        h_enc = nl(tf.matmul(x, w_1) + b_1)
        w_2 = weight_variable([num_hid_enc, num_hid], wd=wd)
        b_2 = weight_variable([num_hid], wd=wd)
        mu_enc = tf.matmul(h_enc, w_2) + b_2
        w_3 = weight_variable([num_hid_enc, num_hid], wd=wd)
        b_3 = weight_variable([num_hid], wd=wd)
        log_sigma_enc = tf.matmul(h_enc, w_3) + b_3
        t = tf.placeholder('float', [None, num_hid])
        z = mu_enc + tf.exp(log_sigma_enc) * t
        kl_qzx_pz = -0.5 * tf.reduce_sum(
            1 + 2 * log_sigma_enc - mu_enc * mu_enc -
            tf.exp(2 * log_sigma_enc))
        w_4 = weight_variable([num_hid, num_hid_dec], wd=wd)
        b_4 = weight_variable([num_hid_dec], wd=wd)
        h_dec = nl(tf.matmul(z, w_4) + b_4)
        w_5 = weight_variable([num_hid_dec, num_inp], wd=wd)
        b_5 = weight_variable([num_inp], wd=wd)
        mu_dec = tf.sigmoid(tf.matmul(h_dec, w_5) + b_5)
        log_pxz = tf.reduce_sum(x * tf.log(mu_dec + 1e-7) +
                                (1 - x) * tf.log((1 - mu_dec + 1e-7)))
        num_ex = tf.shape(x)
        w_kl = 1.0
        w_logp = 1.0
        log_px_lb = (-w_kl * kl_qzx_pz + w_logp * log_pxz) / \
            (w_kl + w_logp) * 2.0 / tf.to_float(num_ex[0])
        tf.add_to_collection('losses', -log_px_lb)
        total_loss = tf.add_n(tf.get_collection('losses'))

        lr = 1e-4
        train_step = tf.train.AdamOptimizer(lr).minimize(total_loss)

    return {'x': x, 't': t, 'w_1': w_1, 'h_enc': h_enc, 'h_dec': h_dec,
            'log_px_lb': log_px_lb, 'train_step': train_step,
            'w_4': w_4, 'b_4': b_4, 'w_5': w_5, 'b_5': b_5, 'mu_dec': mu_dec}


def preprocess(x, opt):
    return (x > 0.5).astype('float32').reshape([-1, 28 * 28])


def get_model_id(task_name):
    time_obj = datetime.datetime.now()
    model_id = timestr = '{}-{:04d}{:02d}{:02d}{:02d}{:02d}{:02d}'.format(
        task_name, time_obj.year, time_obj.month, time_obj.day,
        time_obj.hour, time_obj.minute, time_obj.second)

    return model_id


def plot_digits(fname, data, num_row, num_col):
    f, axarr = plt.subplots(num_row, num_col, figsize=(10, num_row))

    for ii in xrange(num_row):
        for jj in xrange(num_col):
            axarr[ii, jj].set_axis_off()
            idx = ii * num_col + jj
            axarr[ii, jj].imshow(data[idx], cmap=cm.Greys_r)

    plt.tight_layout(pad=0.0, w_pad=0.0, h_pad=0.0)
    plt.savefig(fname, dpi=80)


def parse_args():
    """Parse input arguments."""
    parser = argparse.ArgumentParser(description='Train VAE')
    parser.add_argument('-logs', default='../logs',
                        help='Training curve logs folder')
    args = parser.parse_args()

    return args

if __name__ == '__main__':
    # Command-line arguments
    args = parse_args()

    # Model ID
    model_id = get_model_id('vae_mnist')

    # Log folder
    logs_folder = args.logs
    exp_logs_folder = os.path.join(logs_folder, model_id)

    # Plain text logger
    log = logger.get(os.path.join(exp_logs_folder, 'raw'))
    log.log_args()
    log_register(log.filename, 'plain', 'Raw logs')

    # Create time series loggers
    train_logp_logger = TimeSeriesLogger(
        os.path.join(exp_logs_folder, 'train_logp.csv'),
        label='train logp',
        name='Train log prob',
        buffer_size=3)
    valid_logp_logger = TimeSeriesLogger(
        os.path.join(exp_logs_folder, 'valid_logp.csv'),
        label='valid logp',
        name='Validation log prob',
        buffer_size=1)
    henc_sparsity_logger = TimeSeriesLogger(
        os.path.join(exp_logs_folder, 'henc_sparsity.csv'),
        label='henc sparsity',
        name='Encoder hidden activation sparsity',
        buffer_size=1)
    hdec_sparsity_logger = TimeSeriesLogger(
        os.path.join(exp_logs_folder, 'hdec_sparsity.csv'),
        label='hdec sparsity',
        name='Decoder hidden activation sparsity',
        buffer_size=1)
    step_time_logger = TimeSeriesLogger(
        os.path.join(exp_logs_folder, 'step_time.csv'),
        label='step time (ms)',
        buffer_size=3)

    # Image loggers
    w1_image_fname = os.path.join(exp_logs_folder, 'w1.png')
    decoder_image_fname = os.path.join(exp_logs_folder, 'decoder.png')
    gen_image_fname = os.path.join(exp_logs_folder, 'gen.png')
    log_register(w1_image_fname, 'image', 'W1 visualization')
    log_register(decoder_image_fname, 'image', 'Decoder reconstruction')
    log_register(gen_image_fname, 'image', 'Generated digits')

    # Dashboard info
    log.info('Dashboard: http://localhost/deep-dashboard?id={}'.format(model_id))

    # Model options
    opt = {
        'num_inp': 28 * 28,
        'num_hid_enc': 100,
        'num_hid': 20,
        'num_hid_dec': 100,
        'non_linear': 'tf.nn.relu',
        'weight_decay': 5e-5
    }

    # MNIST dataset
    dataset = mnist.read_data_sets("../MNIST_data/", one_hot=True)

    # Create models
    m = get_train_model(opt)
    m_dec = get_decoder(opt, m)

    # RNG
    random = np.random.RandomState(2)

    # Start session
    sess = tf.Session()
    sess.run(tf.initialize_all_variables())

    # Train loop
    step = 0
    while step < 50000:
        # Validation
        valid_log_px_lb = 0.0
        henc_sparsity = 0.0
        hdec_sparsity = 0.0
        log.info('Running validation')
        for ii in xrange(100):
            batch = dataset.test.next_batch(100)
            x = preprocess(batch[0], opt)
            t = random.normal(0, 1, [x.shape[0], opt['num_hid']])
            log_px_lb, henc, hdec = sess.run([
                m['log_px_lb'],
                m['h_enc'],
                m['h_dec']],
                feed_dict={
                m['x']: x,
                m['t']: t
            })
            henc_sparsity += (henc == 0.0).sum() / float(henc.size) / 100.0
            hdec_sparsity += (hdec == 0.0).sum() / float(hdec.size) / 100.0
            valid_log_px_lb += log_px_lb / 100.0
        log.info('step {:d}, valid logp {:.4f}'.format(step, valid_log_px_lb))

        num_plot = 50
        x = dataset.test.images[: num_plot]
        t = random.normal(0, 1, [x.shape[0], opt['num_hid']])
        w1, x_rec = sess.run([m['w_1'], m['mu_dec']], feed_dict={
            m['x']: x,
            m['t']: t
        })
        w1 = w1.transpose().reshape([-1, 28, 28])
        z = random.normal(0, 1, [x.shape[0], opt['num_hid']])
        x_ = sess.run(m_dec['mu_x'], feed_dict={
                      m_dec['z']: z}).reshape([-1, 28, 28])
        x_comb = np.array([x, x_rec]).transpose(
            [1, 0, 2]).reshape([-1, 28, 28])

        plot_digits(w1_image_fname, w1, 3, 10)
        plot_digits(decoder_image_fname, x_comb, 3, 10)
        plot_digits(gen_image_fname, x_, 3, 10)
        valid_logp_logger.add(step, valid_log_px_lb)
        henc_sparsity_logger.add(step, henc_sparsity)
        hdec_sparsity_logger.add(step, hdec_sparsity)

        # Train
        for ii in xrange(500):
            batch = dataset.train.next_batch(100)
            x = preprocess(batch[0], opt)
            t = random.normal(0, 1, [x.shape[0], opt['num_hid']])
            st = time.time()
            r = sess.run([m['log_px_lb'], m['train_step']], feed_dict={
                m['x']: x,
                m['t']: random.normal(0, 1, [x.shape[0], opt['num_hid']])
            })
            if step % 10 == 0:
                log_px_lb = r[0]
                step_time = (time.time() - st) * 1000
                log.info('{:d} logp {:.4f} t {:.2f}ms'.format(
                    step, log_px_lb, step_time))
                train_logp_logger.add(step, log_px_lb)
                step_time_logger.add(step, step_time)

            step += 1

    # Clean up
    train_logp_logger.close()
    valid_logp_logger.close()
    henc_sparsity_logger.close()
    hdec_sparsity_logger.close()
    step_time_logger.close()
    sess.close()

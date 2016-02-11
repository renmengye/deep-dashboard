import sys
import os
import socket

if os.path.exists('/u/mren'):
    sys.path.insert(
        0, '/pkgs/tensorflow-gpu-0.5.0/lib/python2.7/site-packages')
    hostname = socket.gethostname()
    if hostname.startswith('guppy'):
        sys.path.insert(
            0, 
            '/u/mren/code/img-count/third_party/tensorflow-gpu/_python_build')
    else:
        sys.path.insert(
            0, '/u/mren/code/img-count/third_party/tensorflow/_python_build')

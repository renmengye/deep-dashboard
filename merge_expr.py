"""
Merge multiple experiments to show it in one dashboard.
Do this after each experiment is finished.

Usage:
python merge_expr.py \
--results {results_folder} \
--input {name}:{exp_id},{name}:{exp_id},... \
--output {new_exp_id}

Example:
"""
from __future__ import print_function
import argparse
import os
import shutil
import sys

if sys.version[0] == "2":
    input = raw_input


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--results', default=None, type=str)
    parser.add_argument('--input', default=None, type=str)
    parser.add_argument('--output', default=None, type=str)
    parser.add_argument('--max_step', default=None, type=int)
    return parser.parse_args()


def get_inputs(inp_str):
    exp_str = inp_str.split(',')
    exp_pair = [_estr.split(':') for _estr in exp_str]
    return exp_pair


def merge(input_pairs, output_folder, max_step=None):
    data = []
    filename_name_map = {}
    filename_type_map = {}
    for ii in xrange(len(input_pairs)):
        data_ii = {}  # filename maps to data_dict
        name = input_pairs[ii][0]
        folder = input_pairs[ii][1]
        # Read catalog
        catalog = os.path.join(folder, 'catalog')
        with open(catalog, 'r') as catalog_file:
            for line in catalog_file:
                parts = line.strip('\n').split(',')
                # Only merge CSV file.
                if parts[1] != 'csv' and parts[1] != 'histogram':
                    continue
                if parts[0] not in filename_name_map:
                    filename_name_map[parts[0]] = parts[2]
                if parts[0] not in filename_type_map:
                    filename_type_map[parts[0]] = parts[1]
                filename = os.path.join(folder, parts[0])

                if parts[1] == 'csv':
                    data_ = []
                    names_ = []
                    with open(filename, 'r') as data_file:
                        for line2 in data_file:
                            parts2 = line2.strip('\n').split(',')
                            if len(data_) == 0:
                                for pp in parts2:
                                    names_.append(pp)
                                    data_.append([])
                            else:
                                do_add = False
                                if max_step is not None:
                                    if int(parts2[0]) < max_step:
                                        do_add = True
                                else:
                                    do_add = True
                                if do_add:
                                    for jj, pp in enumerate(parts2):
                                        if jj == 0:
                                            data_[jj].append(int(pp))
                                        else:
                                            data_[jj].append(pp)

                elif parts[1] == 'histogram':
                    data_ = []
                    names_ = []
                    with open(filename, 'r') as data_file:
                        for line2 in data_file:
                            parts2 = line2.strip('\n').split(',')
                            names_.append(parts2[0])
                            data_.append(parts2[1:])

                data_dict = {}  # For each stats file: key: values.
                for data_jj, name_jj in zip(data_, names_):
                    data_dict[name_jj] = data_jj
                data_ii[parts[0]] = data_dict
        data.append(data_ii)
        pass

    merge_data = {}
    for data_ii in data:
        for kk in data_ii.keys():
            if kk not in merge_data:
                if filename_type_map[kk] == 'csv':
                    merge_data[kk] = []
                elif filename_type_map[kk] == 'histogram':
                    merge_data[kk] = {}

    for ii, data_ii in enumerate(data):  # Experiments.
        for kk in data_ii.keys():  # Filename.

            if filename_type_map[kk] == 'csv':
                for jj in xrange(len(data_ii[kk].values()[0])):  # Time series.
                    item = {}
                    for ll in data_ii[kk].keys():
                        if ll != 'step' and ll != 'time':
                            if len(data_ii[kk].keys()) == 3:
                                ll2 = input_pairs[ii][0]
                            else:
                                ll2 = input_pairs[ii][0] + ' ' + ll
                        else:
                            ll2 = ll
                        item[ll2] = data_ii[kk][ll][jj]
                    merge_data[kk].append(item)

            elif filename_type_map[kk] == 'histogram':
                for jj in data_ii[kk].keys():
                    if len(data_ii[kk].keys()) == 1:
                        ll = input_pairs[ii][0]
                    else:
                        ll = input_pairs[ii][0] + ' ' + jj
                    merge_data[kk][ll] = data_ii[kk][jj]

    for kk in merge_data.keys():
        if filename_type_map[kk] == 'csv':
            merge_data[kk] = sorted(merge_data[kk], key=lambda x: x['step'])

    merge_catalog = os.path.join(output_folder, 'catalog')
    with open(merge_catalog, 'w') as f:
        f.write('filename,type,name\n')
    for kk in merge_data.keys():
        filename = os.path.join(output_folder, kk)

        if filename_type_map[kk] == 'csv':
            all_keys = []
            for jj in xrange(len(merge_data[kk])):
                for ll in merge_data[kk][jj].keys():
                    if ll not in all_keys:
                        all_keys.append(ll)
            with open(filename, 'w') as f:
                f.write('step,time')
                for ll in all_keys:
                    if ll != 'step' and ll != 'time':
                        f.write(',{}'.format(ll))
                f.write('\n')
                for jj in xrange(len(merge_data[kk])):
                    ss = '{},{}'.format(merge_data[kk][jj]['step'],
                                        merge_data[kk][jj]['time'])
                    for ll in all_keys:
                        if ll != 'step' and ll != 'time':
                            ss += ','
                            if ll in merge_data[kk][jj]:
                                ss += '{}'.format(merge_data[kk][jj][ll])
                    f.write('{}\n'.format(ss))

        elif filename_type_map[kk] == 'histogram':
            with open(filename, 'w') as f:
                for jj in sorted(merge_data[kk].keys()):
                    f.write(jj + ',' + ','.join(merge_data[kk][jj]) + '\n')

        with open(os.path.join(output_folder, 'catalog'), 'a') as f:
            f.write('{},{},{}\n'.format(
                kk, filename_type_map[kk], filename_name_map[kk]))


def main():
    args = parse_args()
    if args.input is None:
        raise Exception('Must provide input experiment ID')
    if args.results is None:
        raise Exception('Must provide results folder')
    if args.output is None:
        raise Exception('Must provide output experiment ID')
    input_pairs = get_inputs(args.input)
    for inp in input_pairs:
        inp[1] = os.path.join(args.results, inp[1])
    output_folder = os.path.join(args.results, args.output)
    if not os.path.exists(output_folder):
        os.makedirs(output_folder)
    else:
        confirm = input(
            'Folder "{}" exists, remove and continue? [Y/n] '.format(
                output_folder))
        if confirm != 'n':
            shutil.rmtree(output_folder)
            os.makedirs(output_folder)
        else:
            print('Folder "{}" not removed.'.format(output_folder))
            return
    merge(input_pairs, output_folder, max_step=args.max_step)
    pass

if __name__ == '__main__':
    main()

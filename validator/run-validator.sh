#!/bin/bash

for version in $(echo ${IIIF_VERSIONS:-"2 3"}); do
  iiif-validate.py -s localhost:3000 -p iiif/${version} -i 67352ccc-d1b0-11e1-89ae-279075081939 --version=${version}.0 --level=2 \
    --test baseurl_redirect --test cors --test format_error_random --test format_jpg --test format_png \
    --test id_basic --test id_error_escapedslash --test id_error_random --test id_error_unescaped --test id_escaped \
    --test id_squares --test info_json --test quality_bitonal --test quality_color --test quality_error_random \
    --test quality_grey --test region_error_random --test region_percent --test region_pixels --test rot_error_random \
    --test rot_full_basic --test rot_region_basic --test size_bwh --test size_ch --test size_error_random --test size_percent \
    --test size_region --test size_wc --test size_wh
done

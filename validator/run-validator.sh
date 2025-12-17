#!/bin/bash

for version in $(echo ${IIIF_VERSIONS:-"2 3"}); do
  iiif-validate.py -s localhost:3000 -p iiif/${version} -i 67352ccc-d1b0-11e1-89ae-279075081939 --version=${version}.0 --level=2
done

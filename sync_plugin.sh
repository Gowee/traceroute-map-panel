#!/bin/bash
while true; do
  inotifywait -r -e modify,attrib,close_write,move,create,delete ./
  rsync -av ./ /var/lib/grafana/plugins/traceroute-map-panel/
done

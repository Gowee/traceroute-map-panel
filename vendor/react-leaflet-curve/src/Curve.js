import React from "react";
import PropTypes from "prop-types";
import { Path, withLeaflet } from "react-leaflet";
// import { curve } from "./leaflet.curve";

class Curve extends Path {
  createLeafletElement(props) {
    const { positions, option, ...options } = props;
    return L.curve(positions, option, this.getOptions(options));
  }

  updateLeafletElement(fromProps, toProps) {
    if (toProps.positions !== fromProps.positions) {
      this.leafletElement.setPath(toProps.positions);
    }
    this.setStyleIfChanged(fromProps, toProps);
  }
}

Curve.propTypes = {
  children: PropTypes.oneOfType([
    PropTypes.arrayOf(PropTypes.node),
    PropTypes.node
  ]),
  option: PropTypes.object,
  positions: PropTypes.array.isRequired
};

export default withLeaflet(Curve);

/*
  componentWillMount() {
    super.componentWillMount();
    const { positions, ...options } = this.props
    this.leafletElement = L.curve(positions, this.getOptions(options))
  }*/

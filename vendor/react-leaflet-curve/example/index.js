import React from 'react';
import { render } from 'react-dom';
import CurveExample from "./curve";



const example = (
  <div>
    <h1>React-Leaflet-Curve Example</h1>
    <CurveExample />
  </div>
)

render(example, document.getElementById('app'));
import metadata from './registration.js';
import template from './trackman.html?raw';
import styles from './trackman.css?inline';
import {createModule} from './trackman.js';
import {createFeature} from '../../layout/feature-runtime.js';
export default createFeature(metadata, {template, styles, createModule, initialize:'initTM'});

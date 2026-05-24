import { getIamApiMode } from './apiMode';
import * as httpApi from './httpApi';
import * as mockApi from './mockApi';

export const iamService = getIamApiMode() === 'http' ? httpApi : mockApi;

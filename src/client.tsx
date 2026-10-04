import React from 'react';
import {hydrateRoot} from 'react-dom/client';
import Home from './App';
hydrateRoot(document.getElementById('root')!,<Home initialLang={document.documentElement.lang==='en'?'en':'ar'}/>);

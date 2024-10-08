import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import {createBrowserRouter, redirect, RouterProvider} from 'react-router-dom';
import Voice from './components/Voice';
import Chat from './components/Chat';
import Status from './components/Status';
import Config from './components/Config';
import {APP_PATH} from './Constants';

const router = createBrowserRouter([
  {
    path: APP_PATH,
    element: <Config />,
  },
  {
    path: APP_PATH + '/voice/:guildId/:channelId',
    element: <Voice />,
  },
  {
    path: APP_PATH + '/chat/:guildId/:channelId',
    element: <Chat />,
  },
  {
    path: APP_PATH + '/status/:guildId',
    element: <Status />,
  },
  {
    path: '*',
    loader: () => redirect(APP_PATH),
  },
]);

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

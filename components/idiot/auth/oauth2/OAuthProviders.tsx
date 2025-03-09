import {
  RiGithubFill as GitHub,
  RiGoogleFill as Google,
  RiMicrosoftFill as Microsoft,
  RiShoppingCartLine as ShoppingCartOutlined,
  RiTwitterFill as Twitter,
} from 'react-icons/ri';
import React from 'react';
import { GiTesla } from 'react-icons/gi';

const providers = {
  Amazon: {
    client_id: process.env.NEXT_PUBLIC_AMAZON_CLIENT_ID,
    scope: 'profile',
    uri: 'https://www.amazon.com/ap/oa',
    params: {},
    icon: <ShoppingCartOutlined />,
  },
  Tesla: {
    client_id: process.env.NEXT_PUBLIC_TESLA_CLIENT_ID,
    scope: 'openid offline_access user_data vehicle_device_data vehicle_cmds vehicle_charging_cmds vehicle_location',
    uri: 'https://auth.tesla.com/oauth2/v3/authorize',
    params: {},
    icon: <GiTesla />,
  },
  GitHub: {
    client_id: process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID,
    scope: process.env.NEXT_PUBLIC_GITHUB_SCOPES || 'user:email',
    uri: 'https://github.com/login/oauth/authorize',
    params: {},
    icon: <GitHub />,
  },
  Google: {
    client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    scope: process.env.NEXT_PUBLIC_GOOGLE_SCOPES || 'profile email https://www.googleapis.com/auth/gmail.send',
    uri: 'https://accounts.google.com/o/oauth2/v2/auth',
    params: {
      access_type: 'offline',
    },
    icon: <Google />,
  },
  Microsoft: {
    client_id: process.env.NEXT_PUBLIC_MICROSOFT_CLIENT_ID,
    scope:
      process.env.NEXT_PUBLIC_MICROSOFT_SCOPES ||
      'https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Calendars.ReadWrite.Shared',
    uri: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    params: {},
    icon: <Microsoft />,
  },
  X: {
    client_id: process.env.NEXT_PUBLIC_X_CLIENT_ID,
    scope: 'users.read tweet.read tweet.write offline.access',
    uri: 'https://twitter.com/i/oauth2/authorize',
    params: {},
    icon: <Twitter />,
  },
};

export default providers;

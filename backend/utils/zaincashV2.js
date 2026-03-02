import axios from "axios";

let cachedToken = null;
let tokenExpire = 0;

export const getZainToken = async () => {
  if (cachedToken && Date.now() < tokenExpire) return cachedToken;

  const url = `${process.env.ZC_BASE_URL}/oauth2/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: process.env.ZC_CLIENT_ID,
    client_secret: process.env.ZC_CLIENT_SECRET,
  });

  const { data } = await axios.post(url, body, {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  cachedToken = data.access_token;
  tokenExpire = Date.now() + (data.expires_in - 60) * 1000;

  return cachedToken;
};


export const createPayment = async (payload) => {
  const token = await getZainToken();

  const url = `${process.env.ZC_BASE_URL}/api/v2/payments/initiate`;

  const { data } = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  return data;
};


export const getPaymentStatus = async (transactionId) => {
  const token = await getZainToken();

  const url = `${process.env.ZC_BASE_URL}/api/v2/payments/status/${transactionId}`;

  const { data } = await axios.get(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return data;
};
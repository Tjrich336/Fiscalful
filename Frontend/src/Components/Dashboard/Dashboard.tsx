import React, { useEffect, useContext, useCallback, useState } from "react";
import { Link } from "react-router-dom";
import Header from "../Headers";
import Products from "../ProductTypes/Products";
import Items from "../ProductTypes/Items";
import Context from "../../Context";
import styles from "../../App.module.scss";
import AccessTokenDetails from "./AccessTokenDetails";
import "../Dashboard/dashboard.css";


const App = () => {
  const { linkSuccess, isItemAccess, isPaymentInitiation, dispatch } =
    useContext(Context);
  const [accessTokens, setAccessTokens] = useState([]);

  const getInfo = useCallback(async () => {
    const response = await fetch(`${process.env.REACT_APP_API_HOST}/api/info`, { method: "POST" });
    if (!response.ok) {
      dispatch({ type: "SET_STATE", state: { backend: false } });
      return { paymentInitiation: false };
    }
    const data = await response.json();
    const paymentInitiation: boolean =
      data.products.includes("payment_initiation");
    dispatch({
      type: "SET_STATE",
      state: {
        products: data.products,
        isPaymentInitiation: paymentInitiation,
      },
    });
    return { paymentInitiation };
  }, [dispatch]);

  const generateToken = useCallback(
    async (isPaymentInitiation) => {
      // Link tokens for 'payment_initiation' use a different creation flow in your backend.
      const path = isPaymentInitiation
        ? `${process.env.REACT_APP_API_HOST}/api/create_link_token_for_payment`
        : `${process.env.REACT_APP_API_HOST}/api/create_link_token`;
      const response = await fetch(path, {
        method: "POST",
      });
      if (!response.ok) {
        dispatch({ type: "SET_STATE", state: { linkToken: null } });
        return;
      }
      const data = await response.json();
      if (data) {
        if (data.error != null) {
          dispatch({
            type: "SET_STATE",
            state: {
              linkToken: null,
              linkTokenError: data.error,
            },
          });
          return;
        }
        dispatch({ type: "SET_STATE", state: { linkToken: data.link_token } });
      }
      // Save the link_token to be used later in the Oauth flow.
      localStorage.setItem("link_token", data.link_token);
    },
    [dispatch]
  );
  const queryOnComponentLoad = useCallback(async () => {
    const firebase_user_id = localStorage.getItem("firebase_user_id");
    const response = await fetch(
      `${process.env.REACT_APP_API_HOST}/api/get_tokens_for_user?firebase_user_id=${firebase_user_id}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
    const data = await response.json();
    if (response.ok) {
      setAccessTokens(data);
    }
  }, []);
  useEffect(() => {
    const init = async () => {
      const { paymentInitiation } = await getInfo(); // used to determine which path to take when generating token
      // do not generate a new token for OAuth redirect; instead
      // setLinkToken from localStorage
      if (window.location.href.includes("?oauth_state_id=")) {
        dispatch({
          type: "SET_STATE",
          state: {
            linkToken: localStorage.getItem("link_token"),
          },
        });
        return;
      }
      generateToken(paymentInitiation);
    };
    init();
    queryOnComponentLoad();
  }, [dispatch, generateToken, getInfo, queryOnComponentLoad]);

  interface AccessToken {
    access_token: string;
  }

  const AccessTokenList = ({
    accessTokens,
  }: {
    accessTokens: AccessToken[];
  }) => {
    return (
      <div>
        <h2 className="account-title">Accounts</h2>
        <ul className="account-list">
          {accessTokens.map((token, index) => (
            <li key={index}>
              <Link
                to={`/dashboard/access-token-details/${token.access_token}`}
                className="account-link"
              >
                {`Account ${index + 1}`}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className={styles.App}>
      <div className={styles.container}>
        <Header />
        <AccessTokenList accessTokens={accessTokens} />
        {linkSuccess && (
          <>
            {isPaymentInitiation && <Products />}
            {isItemAccess && (
              <>
                <></>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default App;

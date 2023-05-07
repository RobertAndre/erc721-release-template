import React, { useState, useMemo, useEffect } from 'react';
import {
  ConnectWallet,
  useContract,
  useAddress,
  useActiveClaimCondition,
  useContractMetadata,
  Web3Button,
  useUnclaimedNFTSupply,
  useClaimedNFTSupply,
  useClaimerProofs
} from "@thirdweb-dev/react";
import { ethers, BigNumber } from "ethers";
import { collectionName, collectionURL, currencyName, nftContractAddress, fixNumber, currencyAddress, pricePerToken } from "./const/yourDetails.js";
import "./styles/Home.css";
import styles from "./styles/Theme.module.css";


export default function Home() {
  const { contract: nftDrop } = useContract(nftContractAddress);
  const address = useAddress();
  const [quantity, setQuantity] = useState(1);

  const { data: contractMetadata } = useContractMetadata(nftDrop);


  const { data: activeClaimCondition } = useActiveClaimCondition(nftDrop, "1", {
    withAllowList: true
  });

  const { data: claimerData, isLoading: claimerIsLoading } = useClaimerProofs(nftDrop, address || "");

  const unclaimedSupply = useUnclaimedNFTSupply(nftDrop);
  const claimedSupply = useClaimedNFTSupply(nftDrop);
  const [numClaimed, setNumClaimed] = useState(0);
  const [claimerProofs, setClaimerProofs] = useState({});
  const [maxDiscountNumber, setMaxDiscountNumber] = useState(0);

  const [finalPrice, setFinalPrice] = useState(pricePerToken);
  const [isOnAllowList, setIsOnAllowList] = useState(false);

  const numberClaimed = useMemo(() => {
    return BigNumber.from(claimedSupply?.data || 0).toString();
  }, [claimedSupply]);

  const numberTotal = useMemo(() => {
    return BigNumber.from(claimedSupply?.data || 0)
      .add(BigNumber.from(unclaimedSupply?.data || 0))
      .toString();
  }, [claimedSupply?.data, unclaimedSupply?.data]);




  const ownedNFTs = useMemo(async () => {
    if (!address || !nftDrop) { return []; }

    const nfts = await nftDrop.erc721.getOwned(address);
    setNumClaimed(nfts.length);
    return nfts;

  }, [address, nftDrop]);

  const isLoading = useMemo(() => {
    return (
      activeClaimCondition?.isLoading ||
      unclaimedSupply?.isLoading ||
      claimedSupply?.isLoading ||
      !nftDrop
    );
  }, [
    activeClaimCondition?.isLoading,
    nftDrop,
    claimedSupply?.isLoading,
    unclaimedSupply?.isLoading,
  ]);

  useEffect(() => {
    let allowlistProof = {}
    const notOnAllowList = {
      proof: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
      quantityLimitPerWallet: { "type": "BigNumber", "hex": "0x0" },
      pricePerToken: { "type": "BigNumber", "hex": "0x0" },
      currency: currencyAddress
    };
    if (!claimerIsLoading && address) {
     
      if (typeof claimerData !== 'undefined' && claimerData !== null) {

        console.log("claimerData", JSON.stringify(claimerData));
       
        const maxClaims = Number.parseInt(claimerData?.maxClaimable);
        setMaxDiscountNumber(maxClaims || 0);
        const ppToken = Number.parseInt(claimerData?.price);
        const maxClaim = ethers.utils.hexValue(maxClaims);
        const ppT = ethers.utils.hexValue(ppToken);

        allowlistProof = {
          proof: claimerData?.proof,
          quantityLimitPerWallet: { "type": "BigNumber", "hex": maxClaim },
          pricePerToken: { "type": "BigNumber", "hex": ppT },
          currency: currencyAddress
        };
      
        setIsOnAllowList(true);
      } else {

        allowlistProof = notOnAllowList;

      }

    } else {
      allowlistProof = notOnAllowList;
    }
    console.log('claimerData', JSON.stringify(allowlistProof));
    
    setClaimerProofs(allowlistProof);


  }, [claimerData, claimerIsLoading, address]);



  const maxClaimable = useMemo(() => {
    let bnMaxClaimable;
    try {
      bnMaxClaimable = BigNumber.from(
        activeClaimCondition?.maxClaimableSupply || 0
      );
    } catch (e) {
      bnMaxClaimable = BigNumber.from(1_000_000);
    }

    let perTransactionClaimable;
    try {
      perTransactionClaimable = BigNumber.from(
        activeClaimCondition?.maxClaimablePerWallet || 0
      );
    } catch (e) {
      perTransactionClaimable = BigNumber.from(1_000_000);
    }

    if (perTransactionClaimable.lte(bnMaxClaimable)) {
      bnMaxClaimable = perTransactionClaimable;
    }

    const snapshotClaimable = claimerProofs?.data?.maxClaimable;

    // // console.log("snapshotClaimable:" + JSON.stringify(claimerProofs?.data));
    // if (claimerProofs?.data?.proof) {
    //   setClaimProof(claimerProofs.data.proof);
    //   // console.log("Claimers proof!:" + JSON.stringify(claimerProofs.data.proof));
    // }
    if (snapshotClaimable) {
      if (snapshotClaimable === "0") {
        // allowed unlimited for the snapshot
        bnMaxClaimable = BigNumber.from(1_000_000);
      } else {
        try {
          bnMaxClaimable = BigNumber.from(snapshotClaimable);

        } catch (e) {
          // fall back to default case
        }
      }
    }

    const maxAvailable = BigNumber.from(unclaimedSupply.data || 0);

    let max;
    if (maxAvailable.lt(bnMaxClaimable)) {
      max = maxAvailable;
    } else {
      max = bnMaxClaimable;
    }

    if (max.gte(1_000_000)) {
      return 1_000_000;
    }
    return max.toNumber();
  }, [
   
    claimerProofs?.data?.maxClaimable,
    unclaimedSupply.data,
    activeClaimCondition?.maxClaimableSupply,
    activeClaimCondition?.maxClaimablePerWallet,
  ]);


  useEffect(() => {
   
      let price = 0;
      let PPT = pricePerToken;
      let basePrice = PPT * quantity;
      console.log(JSON.stringify(claimerProofs));
  
      if (isOnAllowList) {
       
          const Maxfree = maxDiscountNumber;
          const discount = numClaimed >= parseInt(Maxfree) ? 0 : Maxfree - numClaimed;
          const newQuantity = discount > 0 && discount > quantity ? 0 :
            discount > 0 && discount <= quantity ? quantity - discount :
              quantity;
          price = (newQuantity * PPT);
          const finalPrice = newQuantity === 0 ? 0 : price.toFixed(fixNumber)
          setFinalPrice(finalPrice);
        } else {
          setFinalPrice(basePrice.toFixed(fixNumber));
        }
     

  }, [quantity, claimerProofs, maxDiscountNumber, isOnAllowList, ownedNFTs, numClaimed]);

 
 

  return (
    <div className="container">
      <main className="main">
        <h1 className="title">
          Welcome to <a href={collectionURL}>{collectionName}</a>!
        </h1>

        <p className="description">
          {contractMetadata?.description}
          Choose how many NFTs you want to mint{" "}
        </p>

        <div className="connect">
          <ConnectWallet dropdownPosition={{ side: 'bottom', align: 'center' }} />
        </div>

        {
          !address ? null :
            isLoading ? <div className="grid"> loading... </div> : <div className="grid">
       
                  <p>Quantity</p>
                  <div className={styles.quantityContainer}>
                    <button
                      className={`${styles.quantityControlButton}`}
                      onClick={() =>  setQuantity(quantity - 1)}
                      disabled={quantity <= 1}
                    >
                      -
                    </button>

                    <h4>{quantity}</h4>

                    <button
                      className={`${styles.quantityControlButton}`}
                      onClick={() =>  setQuantity(quantity + 1)}
                      disabled={quantity >= maxClaimable}
                    >
                      +
                    </button>
                  </div>
              <div className={styles.mintAreaLeft}>
                <p>Total Minted</p>
              </div>
              <div className={styles.mintAreaRight}>
                {claimedSupply && unclaimedSupply ? (
                  <p>
                    <b>{numberClaimed}</b>
                    {" / "}
                    {numberTotal}
                  </p>
                ) : (
                  <p>Loading...</p>
                )}
              </div>
              <Web3Button
                contractAddress={nftContractAddress}
                action={async (contract) => {
            
                  const pricePerTokenNftBasePrice = ethers.utils.parseEther(pricePerToken);
                  const finalPriceFormatted = ethers.utils.parseEther(finalPrice);

                  console.log("claimerProofs", claimerProofs)
                  const data = await contract.call("claim", [address, quantity, currencyAddress, pricePerTokenNftBasePrice, claimerProofs, "0x00"],
                    {
                      value: finalPriceFormatted,
                    })
                    console.log(JSON.stringify(data));

                }}
                isDisabled={quantity < 1 || isLoading }
              >
                Mint{' '}
                
                {
                finalPrice === 0 ? 'Free' : finalPrice + ' ' + currencyName}
              </Web3Button>
            </div>}
      </main>
    </div>
  );
}

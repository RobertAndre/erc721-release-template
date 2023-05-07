import React, { useState, useMemo } from 'react';
import {
  ConnectWallet,
  useContract,
  useAddress,
  useActiveClaimCondition,
  useContractMetadata,
  useClaimIneligibilityReasons,
  Web3Button,
  useUnclaimedNFTSupply,
  useClaimedNFTSupply,

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

 
  const claimIneligibilityReasons = useClaimIneligibilityReasons(nftDrop, {
    quantity,
    walletAddress: address || "",
  });

  const unclaimedSupply = useUnclaimedNFTSupply(nftDrop);
  const claimedSupply = useClaimedNFTSupply(nftDrop);

  const [numClaimed, setNumClaimed] = useState(0);
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


  const canClaim = useMemo(() => {
    return (
      activeClaimCondition?.isSuccess &&
      claimIneligibilityReasons?.isSuccess &&
      claimIneligibilityReasons?.data?.length === 0
    );
  }, [
    activeClaimCondition?.isSuccess,
    claimIneligibilityReasons?.data?.length,
    claimIneligibilityReasons?.isSuccess,
  ]);



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
 
  const claimerProofs = useMemo(() => {
    if (!address || !nftDrop ) return {};

    const notOnAllowList =  {
      proof: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
      quantityLimitPerWallet: { "type": "BigNumber", "hex": "0x0" },
      pricePerToken: { "type": "BigNumber", "hex": "0x0" },
      currency: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
    };
  
    const getClaimVerification = async () => {

      const claimVerification = await nftDrop.erc721.claimConditions.getClaimerProofs(address);
      if (typeof claimVerification !== 'undefined' && claimVerification !== null) {

          const maxClaims = Number.parseInt(claimVerification?.maxClaimable);
          const ppToken = ethers.utils.parseEther(claimVerification?.price);
          const maxClaim = ethers.utils.hexValue(maxClaims);
          setMaxDiscountNumber(claimVerification?.maxClaimable || "0");
          const ppT = ethers.utils.hexValue(ppToken);
          setIsOnAllowList(true);

          const allowlistProof = {
            proof: claimVerification?.proof,
            quantityLimitPerWallet: { "type": "BigNumber", "hex": maxClaim },
            pricePerToken: { "type": "BigNumber", "hex": ppT },
            currency: claimVerification?.currencyAddress.toString()
          };
          console.log("allowlistProof", JSON.stringify(allowlistProof));
          return allowlistProof;

        }else{
          console.log("Not On Allow");
          return notOnAllowList;
        }
    }
    return getClaimVerification();

  }, [nftDrop, address]);



  const calculateNewPrice = (quantity) => {
    // if you want to limit the amount they can claim catch it here 
    // check if quantity is bigger than you want and set quanity to your max.
    setQuantity(quantity);

    let price = 0;
    let PPT = pricePerToken;
    const basePrice = PPT * quantity;

    if (isOnAllowList) {
      const Maxfree = maxDiscountNumber;
      const discount = numClaimed >= parseInt(Maxfree) ? 0 : Maxfree - numClaimed;
      const newQuantity = discount > 0 && discount > quantity ? 0 :
        discount > 0 && discount <= quantity ? quantity - discount :
          quantity;
      price = (newQuantity * PPT);

      setFinalPrice(price.toFixed(fixNumber));
    } else {
      setFinalPrice(basePrice.toFixed(fixNumber));
    }


  }
 

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
              <label>
                Quantity:
                <input type="number"
                  value={quantity}
                  onChange={(e) => calculateNewPrice(e.target.value)}
                />
              </label>
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

                  console.log("finalPriceFormatted", finalPriceFormatted)
                  const data = await contract.call("claim", [address, quantity, currencyAddress, pricePerTokenNftBasePrice, claimerProofs, "0x00"],
                    {
                      value: finalPriceFormatted,
                    })
                    console.log(JSON.stringify(data));

                }}
                isDisabled={quantity <= 1 || !canClaim || isLoading || claimerProofs.length < 2}
              >
                Mint{' '}
                {finalPrice === 0 ? 'Free' : finalPrice + ' ' + currencyName}
              </Web3Button>
            </div>}
      </main>
    </div>
  );
}

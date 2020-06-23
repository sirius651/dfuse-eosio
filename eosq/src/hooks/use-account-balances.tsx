import gql from "graphql-tag"
import { getTokenInfosByKeyMap } from "../helpers/airdrops-list"

import {
  useGraphqlQuery,
  PromiseState,
  promiseStateRetype,
  promiseStateResolved
} from "@dfuse/explore"
import { GraphqlResponseError } from "@dfuse/client"
import { DocumentNode } from "graphql"

export type UserBalance = {
  contract: string
  symbol: string
  balance: string
  metadata: {
    name: string
    logo?: string
  }
}

const document = gql`
  query($account: String!) {
    accountBalances(
      account: $account
      options: EOS_INCLUDE_STAKED
      sortField: AMOUNT
      sortOrder: ASC
    ) {
      edges {
        node {
          contract
          symbol
          balance
        }
      }
    }
  }
`

type Document = {
  accountBalances: {
    edges: {
      node: UserBalance
    }[]
  }
}

const tokenInfos = getTokenInfosByKeyMap()

export function useAccountBalances(
  account: string
): PromiseState<UserBalance[], GraphqlResponseError[]> {
  // temporary type casting to fix symlink dev
  const response = useGraphqlQuery<Document>(document as DocumentNode, { account })
  if (response.state === "pending" || response.state === "rejected") {
    return promiseStateRetype(response)
  }

  const balances = response.result.accountBalances.edges
    .map(({ node }) => node)
    .filter((balance) => balance.contract !== "eosio.token")

  balances.forEach((balance) => {
    const metadata = tokenInfos[balance.contract + balance.symbol]

    balance.metadata = {
      name: (metadata && metadata.name) || balance.symbol,
      logo: metadata && metadata.logo
    }
  })

  balances.sort((a, b) => {
    const ma = a.metadata
    const mb = b.metadata

    if (ma.logo && !mb.logo) return -1
    if (!ma.logo && mb.logo) return 1

    if (ma.name.toLowerCase() < mb.name.toLowerCase()) return -1
    if (ma.name.toLowerCase() > mb.name.toLowerCase()) return 1

    return 0
  })

  return promiseStateResolved(balances)
}

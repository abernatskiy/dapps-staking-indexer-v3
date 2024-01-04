import { Store } from "@subsquid/typeorm-store";
import { Dapp, DappAggregatedDaily, Stake, Subperiod } from "../model";
import { Event, ProcessorContext } from "../processor";
import { Entities, getFirstTimestampOfTheDay } from "../utils";
import { IsNull } from "typeorm";

export async function handleSubperiod(
  ctx: ProcessorContext<Store>,
  event: Event,
  entities: Entities
): Promise<void> {
  const day = getFirstTimestampOfTheDay(event.block.timestamp ?? 0);

  entities.SubperiodsToInsert.push(
    new Subperiod({
      id: event.id,
      type: event.args.subperiod.__kind,
      blockNumber: event.block.height,
      timestamp: BigInt(day),
    })
  );

  // Zero out stakers count for all dapps when the subperiod is Voting
  if (event.args.subperiod.__kind === "Voting") {
    try {
      // Dapp Store
      const dapps = await ctx.store.find(Dapp);
      for (const dapp of dapps) {
        dapp.stakersCount = 0;
        entities.DappsToUpdate.push(dapp);

        // // DappAggregatedDaily Store
        // let aggregated = await ctx.store.findOneBy(DappAggregatedDaily, {
        //   timestamp: BigInt(day),
        //   dappAddress: dapp.id,
        // });

        // if (aggregated) {
        //   aggregated.stakersCount = 0;
        //   entities.StakersCountToUpdate.push(aggregated);
        // }

        // Stake Store
        let stakes = await ctx.store.findBy(Stake, {
          dappAddress: dapp.id,
          expiredAt: IsNull(),
        });

        for (const stake of stakes) {
          stake.expiredAt = BigInt(day);
          stake.expiredBlockNumber = event.block.height;
          entities.StakesToUpdate.push(stake);
        }
      }
    } catch (error) {
      console.error("Error fetching Dapps:", error);
    }
  }
}

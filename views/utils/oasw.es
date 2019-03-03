import _ from 'lodash'

const hasSome = pred => xs => xs.some(pred)

const iconIs = n => equip => equip.api_type[3] === n
const shipIdIs = n => ship => ship.api_ship_id === n

const isSonar = iconIs(18)
const isDiveBomber = equip => equip.api_type[2] === 7
const isTorpedoBomber = equip => equip.api_type[2] === 8

// TODO: we'd better distinguish between countBouns or not
const taisenAbove = value => ship => ship.api_taisen[0] >= value

/* prettier-ignore */
const unconditionalOASWShipIds = [
  // Isuzu Kai Ni
  141,
  // Jervis Kai
  394,
  // Tatsuta Kai Ni
  478,
  // Samuel B. Robert Kai
  681,
  // Johnston & Johnston Kai
  562, 689,
]

const isASWAircraft = equip =>
  // 対潜哨戒機 (e.g. 三式指揮連絡機(対潜))
  equip.api_type[3] === 26 ||
  // オートジャイロ (e.g. カ号観測機)
  equip.api_type[3] === 69

const equipTais = equip => equip.api_tais || 0
const equipTaisAbove = value => equip => equipTais(equip) >= value

// focus on the 2nd argument of isOASW for func
const overEquips = func => (_ship, equips) => func(equips)

const oaswShipTypes = [
  // 駆逐
  2,
  // 軽巡
  3,
  // 雷巡
  4,
  // 練巡
  21,
  // 補給
  22,
]

/* prettier-ignore */
const isTaiyouClassKaiOrKaiNi = _.overSome([
  // Taiyou Kai
  380,
  // Shinyou Kai
  381,
  // Taiyou Kai Ni
  529,
  // Shinyou Kai Ni
  536,
].map(shipId => shipIdIs(shipId)))

/*
   - reference as of Mar 3, 2019: (TODO: not all implemented yet since Oct 18, 2018)

       http://wikiwiki.jp/kancolle/?%C2%D0%C0%F8%C0%E8%C0%A9%C7%FA%CD%EB%B9%B6%B7%E2

   - regarding _.overSome, _.overEvery:

       * `_.overSome(f1, f2, ...)(...args)` is the same as `f1(...args) || f2(...args) || ...`.
         _.overEvery works similarly.

       * ship predicates (functions of Ship => bool) can be directly used

       * equips predicates (functions of Array<Equip> => bool) can be used with
         overEquips(<equips predicate>)

 */
// isOASWWith(allCVEIds: Array<ShipMstId>)(ship: Ship, equips: Array<Equip>): bool
/* prettier-ignore */
export const isOASWWith = allCVEIds =>
  _.overSome(
    // 無条件に発動
    _.overSome(unconditionalOASWShipIds.map(shipId => shipIdIs(shipId))),
    // 海防艦
    _.overEvery(
      // is DE
      ship => ship.api_stype === 1,
      _.overSome(
        // 必要対潜60 + ソナー
        _.overEvery(taisenAbove(60), overEquips(hasSome(isSonar))),
        // 必要対潜値75 + 装備のみの対潜値が合計4以上
        _.overEvery(taisenAbove(75), overEquips(equips => _.sum(equips.map(equipTais)) >= 4)),
      ),
    ),
    // 艦種
    _.overEvery(
      ship => oaswShipTypes.includes(ship.api_stype),
      taisenAbove(100),
      overEquips(hasSome(isSonar)),
    ),
    // 大鷹改 大鷹改二
    _.overEvery(
      isTaiyouClassKaiOrKaiNi,
      overEquips(
        hasSome(
          _.overSome(
            // 対潜値1以上の艦攻
            _.overEvery(isTorpedoBomber, equipTaisAbove(1)),
            // 艦爆
            isDiveBomber,
            // 三式指揮連絡機(対潜) / カ号観測機
            isASWAircraft,
          ),
        ),
      ),
    ),
    // 瑞鳳改二
    _.overEvery(
      /*
         Zuihou Kai Ni
         note that this is the non-CVE version with ASW stat modded.
       */
      ship => ship.api_ship_id === 555 && ship.api_kyouka[6] > 0,
      taisenAbove(50),
      overEquips(hasSome(isSonar)),
      overEquips(
        hasSome(
          _.overSome(
            // 対潜値7以上の艦攻
            _.overEvery(isTorpedoBomber, equipTaisAbove(7)),
            // 三式指揮連絡機(対潜) / カ号観測機
            isASWAircraft,
          ),
        ),
      ),
    ),
    /*
       護衛空母 (CVE in general)

       Note: we don't need to explicitly exclude Taiyou-class here
       because their OASW requirement is so lax that we can say
       general rule still applies.
       Surely this will be a bit slower since we need to check more things,
       but it keeps logic a bit more clear and maintainable.
     */
    _.overEvery(
      s => allCVEIds.includes(s.api_ship_id),
      _.overSome(
        // alternative requirement #1
        _.overEvery(
          taisenAbove(50),
          overEquips(hasSome(isSonar)),
          overEquips(
            hasSome(
              _.overSome(
                // 対潜値7以上の艦攻
                _.overEvery(isTorpedoBomber, equipTaisAbove(7)),
                // 三式指揮連絡機(対潜) / カ号観測機
                isASWAircraft,
              ),
            ),
          ),
        ),
        // alternative requirement #2
        _.overEvery(
          taisenAbove(65),
          overEquips(
            hasSome(
              _.overSome(
                // 対潜値7以上の艦攻
                _.overEvery(isTorpedoBomber, equipTaisAbove(7)),
                // 三式指揮連絡機(対潜) / カ号観測機
                isASWAircraft,
              ),
            ),
          ),
        ),
        // alternative requirement #3
        _.overEvery(
          taisenAbove(100),
          overEquips(hasSome(isSonar)),
          overEquips(
            hasSome(
              _.overSome(
                // 対潜値1以上の艦攻
                _.overEvery(isTorpedoBomber, equipTaisAbove(1)),
                // 艦爆
                isDiveBomber,
                // 三式指揮連絡機(対潜) / カ号観測機
                isASWAircraft,
              ),
            ),
          ),
        )
      ),
    ),
  )

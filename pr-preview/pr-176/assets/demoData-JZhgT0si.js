import{c as e}from"./index-CTfeGR17.js";var t=`name,id,back_of,qty,type,layout,image,cost,rules,stats
Ember Scout,,,3,Creature,Demo creature,demo/art/ember-scout.svg,1,"When played, look at the top card of the Fog.",1/1
Hearth Guard,,,3,Creature,Demo creature,demo/art/hearth-guard.svg,2,Blocks first each round.,1/3
Lantern Bearer,,,3,Creature,Demo creature,demo/art/lantern-bearer.svg,2,Your other keepers get +1 while this is in play.,1/2
Ash Warden,,,3,Creature,Demo creature,demo/art/ash-warden.svg,3,"When this leaves play, add 1 ember to any keeper.",2/3
Cinder Hound,,,3,Creature,Demo creature,demo/art/cinder-hound.svg,3,Fast. Can act the round it is played.,3/1
Beacon Keeper,,,2,Creature,Demo creature,demo/art/beacon-keeper.svg,4,"At round start, remove 1 fog from the town.",2/4
Kindle,,,4,Action,Demo action,demo/art/kindle.svg,1,Add 2 embers to a keeper.,
Smoke Screen,,,3,Action,Demo action,demo/art/smoke-screen.svg,2,Ignore the next Fog card this round.,
Flare Shot,,,3,Action,Demo action,demo/art/flare-shot.svg,2,Deal 2 damage to a Fog creature.,
Hearthstone Ward,,,3,Action,Demo action,demo/art/hearthstone-ward.svg,3,Prevent all damage to your keeper this round.,
`,n=`name,id,back_of,qty,type,layout,image,cost,rules,stats
Harbour Wall,,,1,Location,Demo location,demo/art/harbour-wall.svg,,Blocks the first Fog creature each round.,
Lighthouse,,,1,Location,Demo location,demo/art/lighthouse.svg,,"Once per round, reveal the next Fog card.",
Fish Market,,,1,Location,Demo location,demo/art/fish-market.svg,,Keepers here heal 1 damage each round.,
Old Pier,,,1,Location,Demo location,demo/art/old-pier.svg,,Keepers here can move to any place.,
Boathouse,,,1,Location,Demo location,demo/art/boathouse.svg,,"Store up to two cards here, face down.",
Chapel Bell,,,1,Location,Demo location,demo/art/chapel-bell.svg,,Ring it to clear one fog from the town.,
`,r=`{
  "format": "proxy-layouts",
  "version": 1,
  "layouts": [
    {
      "id": "demo-creature",
      "name": "Demo creature",
      "orientation": "portrait",
      "boxes": [
        {
          "id": "frame",
          "x": 0,
          "y": 0,
          "width": 100,
          "height": 100,
          "content": {
            "kind": "color"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#7a3b2e"
          }
        },
        {
          "id": "name-plate",
          "x": 4,
          "y": 3,
          "width": 74,
          "height": 9,
          "content": {
            "kind": "color"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "name",
          "x": 6,
          "y": 3,
          "width": 70,
          "height": 9,
          "content": {
            "kind": "column",
            "columns": [
              "name"
            ],
            "as": "text"
          },
          "style": {
            "size": 10,
            "weight": 700,
            "align": "left",
            "valign": "middle",
            "font": "sans",
            "color": "#1e1c1a"
          }
        },
        {
          "id": "cost",
          "x": 81,
          "y": 3,
          "width": 15,
          "height": 9,
          "content": {
            "kind": "column",
            "columns": [
              "cost"
            ],
            "as": "text"
          },
          "style": {
            "size": 10,
            "weight": 700,
            "align": "center",
            "valign": "middle",
            "font": "mono",
            "color": "#ffffff",
            "background": "#1e1c1a"
          },
          "label": "Cost"
        },
        {
          "id": "art",
          "x": 4,
          "y": 15,
          "width": 92,
          "height": 40,
          "content": {
            "kind": "column",
            "columns": [
              "image"
            ],
            "as": "image"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "type",
          "x": 4,
          "y": 57,
          "width": 92,
          "height": 7,
          "content": {
            "kind": "column",
            "columns": [
              "type"
            ],
            "as": "text"
          },
          "style": {
            "size": 8,
            "weight": 600,
            "align": "left",
            "valign": "middle",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "rules",
          "x": 4,
          "y": 66,
          "width": 92,
          "height": 21,
          "content": {
            "kind": "column",
            "columns": [
              "rules"
            ],
            "as": "text"
          },
          "style": {
            "size": 8.5,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#fbf8f2"
          }
        },
        {
          "id": "stats",
          "x": 62,
          "y": 89,
          "width": 34,
          "height": 8,
          "content": {
            "kind": "column",
            "columns": [
              "stats"
            ],
            "as": "text"
          },
          "style": {
            "size": 10,
            "weight": 700,
            "align": "center",
            "valign": "middle",
            "font": "mono",
            "color": "#ffffff",
            "background": "#1e1c1a"
          },
          "label": "Attack and health"
        }
      ]
    },
    {
      "id": "demo-action",
      "name": "Demo action",
      "orientation": "portrait",
      "boxes": [
        {
          "id": "frame",
          "x": 0,
          "y": 0,
          "width": 100,
          "height": 100,
          "content": {
            "kind": "color"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#2f5d62"
          }
        },
        {
          "id": "name-plate",
          "x": 4,
          "y": 3,
          "width": 74,
          "height": 9,
          "content": {
            "kind": "color"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "name",
          "x": 6,
          "y": 3,
          "width": 70,
          "height": 9,
          "content": {
            "kind": "column",
            "columns": [
              "name"
            ],
            "as": "text"
          },
          "style": {
            "size": 10,
            "weight": 700,
            "align": "left",
            "valign": "middle",
            "font": "sans",
            "color": "#1e1c1a"
          }
        },
        {
          "id": "cost",
          "x": 81,
          "y": 3,
          "width": 15,
          "height": 9,
          "content": {
            "kind": "column",
            "columns": [
              "cost"
            ],
            "as": "text"
          },
          "style": {
            "size": 10,
            "weight": 700,
            "align": "center",
            "valign": "middle",
            "font": "mono",
            "color": "#ffffff",
            "background": "#1e1c1a"
          },
          "label": "Cost"
        },
        {
          "id": "art",
          "x": 4,
          "y": 15,
          "width": 92,
          "height": 32,
          "content": {
            "kind": "column",
            "columns": [
              "image"
            ],
            "as": "image"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "type",
          "x": 4,
          "y": 49,
          "width": 92,
          "height": 7,
          "content": {
            "kind": "column",
            "columns": [
              "type"
            ],
            "as": "text"
          },
          "style": {
            "size": 8,
            "weight": 600,
            "align": "left",
            "valign": "middle",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "rules",
          "x": 4,
          "y": 58,
          "width": 92,
          "height": 38,
          "content": {
            "kind": "column",
            "columns": [
              "rules"
            ],
            "as": "text"
          },
          "style": {
            "size": 8.5,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#fbf8f2"
          }
        }
      ]
    },
    {
      "id": "demo-location",
      "name": "Demo location",
      "orientation": "landscape",
      "boxes": [
        {
          "id": "frame",
          "x": 0,
          "y": 0,
          "width": 100,
          "height": 100,
          "content": {
            "kind": "color"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#3b4a6b"
          }
        },
        {
          "id": "name-plate",
          "x": 3,
          "y": 5,
          "width": 94,
          "height": 15,
          "content": {
            "kind": "color"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "name",
          "x": 5,
          "y": 5,
          "width": 90,
          "height": 15,
          "content": {
            "kind": "column",
            "columns": [
              "name"
            ],
            "as": "text"
          },
          "style": {
            "size": 13,
            "weight": 700,
            "align": "left",
            "valign": "middle",
            "font": "sans",
            "color": "#1e1c1a"
          }
        },
        {
          "id": "art",
          "x": 3,
          "y": 24,
          "width": 40,
          "height": 71,
          "content": {
            "kind": "column",
            "columns": [
              "image"
            ],
            "as": "image"
          },
          "style": {
            "size": 9,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "type",
          "x": 47,
          "y": 24,
          "width": 50,
          "height": 11,
          "content": {
            "kind": "column",
            "columns": [
              "type"
            ],
            "as": "text"
          },
          "style": {
            "size": 9,
            "weight": 600,
            "align": "left",
            "valign": "middle",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#f3ece0"
          }
        },
        {
          "id": "rules",
          "x": 47,
          "y": 38,
          "width": 50,
          "height": 57,
          "content": {
            "kind": "column",
            "columns": [
              "rules"
            ],
            "as": "text"
          },
          "style": {
            "size": 11,
            "weight": 400,
            "align": "left",
            "valign": "top",
            "font": "sans",
            "color": "#1e1c1a",
            "background": "#fbf8f2"
          }
        }
      ]
    }
  ]
}
`,i=[{pileId:`pile-p1-main`,fileName:`emberguard.csv`,cardSetId:`demo-emberguard`,keepOrder:!1,csv:t},{pileId:`pile-p2-main`,fileName:`tidewardens.csv`,cardSetId:`demo-tidewardens`,keepOrder:!1,csv:`name,id,back_of,qty,type,layout,image,cost,rules,stats
Tide Scout,,,3,Creature,Demo creature,demo/art/tide-scout.svg,1,"When played, draw a card.",1/1
Net Mender,,,3,Creature,Demo creature,demo/art/net-mender.svg,2,Heal 1 damage from a card each round.,1/2
Reef Guard,,,3,Creature,Demo creature,demo/art/reef-guard.svg,2,Blocks first each round.,1/3
Salt Sentinel,,,3,Creature,Demo creature,demo/art/salt-sentinel.svg,3,Cannot be damaged by Fog events.,2/3
Wave Rider,,,3,Creature,Demo creature,demo/art/wave-rider.svg,3,Fast. Can move to any place.,3/1
Tide Caller,tide-caller,,2,Creature,Demo creature,demo/art/tide-caller.svg,4,Flip at round end. Rising: draw two cards.,2/4
Ebb Caller,,tide-caller,,Creature,Demo creature,demo/art/ebb-caller.svg,4,Flip at round end. Ebbing: put a card from hand on the deck.,2/4
Mend,,,4,Action,Demo action,demo/art/mend.svg,1,Heal 2 damage from a card.,
Undertow,,,3,Action,Demo action,demo/art/undertow.svg,2,Return a Fog creature to the Fog deck.,
Current Step,,,3,Action,Demo action,demo/art/current-step.svg,2,Move a keeper to any place.,
Pearl Ward,,,3,Action,Demo action,demo/art/pearl-ward.svg,3,A keeper takes no damage until your next turn.,
`},{pileId:`pile-env`,fileName:`the-fog.csv`,cardSetId:`demo-the-fog`,keepOrder:!1,csv:`name,id,back_of,qty,type,layout,image,cost,rules,stats
Drifting Mist,,,3,Fog,Demo creature,demo/art/drifting-mist.svg,1,Creeps in at round start.,1/1
Thick Murk,,,3,Fog,Demo creature,demo/art/thick-murk.svg,2,Hides the card below it.,1/3
Cold Damp,,,3,Fog,Demo creature,demo/art/cold-damp.svg,2,Keepers here cannot gain embers.,2/2
Creeping Gloom,,,3,Fog,Demo creature,demo/art/creeping-gloom.svg,3,Grows +1/+1 each round.,2/2
Foghorn Echo,,,2,Event,Demo action,demo/art/foghorn-echo.svg,2,Every keeper discards a card.,
Lost Lantern,,,2,Event,Demo action,demo/art/lost-lantern.svg,1,Remove a lantern from play.,
Rolling Bank,rolling-bank,,2,Fog,Demo creature,demo/art/rolling-bank.svg,4,Flip when damaged. Rolling: 3/5.,3/5
Clearing Bank,,rolling-bank,,Fog,Demo creature,demo/art/clearing-bank.svg,0,Discard at round end. The town breathes again.,0/1
Salt Gale,,,2,Event,Demo action,demo/art/salt-gale.svg,3,Deal 1 damage to every keeper.,
`},{pileId:`pile-board`,fileName:`harbour-board.csv`,cardSetId:`demo-harbour-board`,keepOrder:!0,csv:n}],a=e(r);if(`error`in a)throw Error(`Demo layouts are invalid: ${a.error}`);var o=a.layouts;export{o as DEMO_LAYOUTS,i as DEMO_PILES};
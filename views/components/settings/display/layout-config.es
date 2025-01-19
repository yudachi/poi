/* global config, toggleModal */
import React, { Component } from 'react'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { get, compact } from 'lodash'
import { Button, ButtonGroup, Intent, FormGroup } from '@blueprintjs/core'
import { withNamespaces } from 'react-i18next'
import { styled } from 'styled-components'

import { Section, Wrapper } from 'views/components/settings/components/section'

const SVG = {
  horizontal: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path d="M1 2v12h14V2zm9 11H2V3h8z" fill="currentColor" />
    </svg>
  ),
  vertical: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path d="M1 2v12h14V2zm13 7H2V3h12z" fill="currentColor" />
    </svg>
  ),
  separate: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path fill="currentColor" d="M3 2v10h12V2H3zm11 9H4V5h10v5z" />
      <path fill="currentColor" d="M2 13V5H1v9h13v-1h-3z" />
    </svg>
  ),
  panel: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path fill="none" stroke="currentColor" d="M.5 1.5h15v13H.5zM9.5 2v12V2z" />
    </svg>
  ),
  grid: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path d="M1 2v12h14V2H1M2 10H10V13H2ZM11 3H14V13H11Z" fill="currentColor" />
    </svg>
  ),
  singleTab: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path fill="currentColor" d="M1 1v12h14V1H1zm1 3h12v8H2V4z" />
    </svg>
  ),
  doubleTabHorizontal: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path fill="currentColor" d="M1 1v12h14V1H1zm1 3h4.999v8H2V4zm12 8H8.999V4H14v8z" />
    </svg>
  ),
  doubleTabVertical: (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">
      <path d="M1 2v12h14V2H1zm13 11H2v-3h12v3zm0-5H2V5h12v3z" id="iconBg" fill="currentColor" />
    </svg>
  ),
}

const Icon = styled.span`
  height: 16px;
  line-height: 16px;
  min-width: 16px;
  display: flex;
  transform: ${(props) =>
    compact([props.invertX && 'scaleX(-1)', props.invertY && 'scaleY(-1)']).join(' ')};
`

@withNamespaces(['setting'])
@connect((state, props) => ({
  layout: get(state.config, 'poi.layout.mode', 'horizontal'),
  enableDoubleTabbed: get(state.config, 'poi.tabarea.double', false),
  verticalDoubleTabbed: get(state.config, 'poi.tabarea.vertical', false),
  reversed: get(state.config, 'poi.layout.reverse', false),
  isolateGameWindow: get(state.config, 'poi.layout.isolate', false),
  overlayPanel: get(state.config, 'poi.layout.overlay', false),
  gridPanel: get(state.config, 'poi.layout.grid', false),
}))
export class LayoutConfig extends Component {
  static propTypes = {
    enableDoubleTabbed: PropTypes.bool,
    layout: PropTypes.string,
    reversed: PropTypes.bool,
    isolateGameWindow: PropTypes.bool,
  }

  createConfirmModal = (callback) => {
    const { t } = this.props
    const title = t('setting:Apply changes')
    const content = t('setting:Game page will be refreshed')
    const footer = [
      {
        name: t('others:Confirm'),
        func: callback,
        style: 'warning',
      },
    ]
    toggleModal(title, content, footer)
  }

  handleSetLayout = (layout, rev) => {
    if (this.props.isolateGameWindow) {
      this.createConfirmModal(() => this.setLayout(layout, rev))
    } else {
      this.setLayout(layout, rev)
    }
  }

  setLayout = (layout, rev) => {
    if (this.props.isolateGameWindow) {
      this.setIsolateGameWindow(false)
    }
    if (this.props.overlayPanel) {
      this.setOverlayPanel(false)
    }
    if (this.props.gridPanel) {
      this.setGridPanel(false)
    }
    config.set('poi.layout.mode', layout)
    config.set('poi.layout.reverse', rev)
  }

  handleSetIsolateGameWindow = () => {
    if (!this.props.isolateGameWindow) {
      this.createConfirmModal((e) => {
        if (this.props.overlayPanel || this.props.gridPanel) {
          this.setLayout('horizontal', false)
        }
        this.setIsolateGameWindow(true)
      })
    }
  }

  handleSetOverlayPanel = () => {
    if (this.props.isolateGameWindow || this.props.gridPanel) {
      this.createConfirmModal(() => {
        this.setLayout('horizontal', false)
        this.setOverlayPanel(true)
      })
      return
    }

    this.setOverlayPanel(!this.props.overlayPanel)
  }

  handleSetGridPanel = () => {
    if (this.props.isolateGameWindow || this.props.overlayPanel) {
      this.createConfirmModal(() => {
        this.setLayout('horizontal', false)
        this.setGridPanel(true)
      })
      return
    }

    this.setGridPanel(!this.props.gridPanel)
  }

  setIsolateGameWindow = (flag) => {
    config.set('poi.layout.isolate', flag)
  }

  setOverlayPanel = (flag) => {
    config.set('poi.layout.overlay', flag)
  }

  setGridPanel = (flag) => {
    config.set('poi.layout.grid', flag)
  }

  handleSetDoubleTabbed = (doubleTabbed, vertical) => {
    config.set('poi.tabarea.double', doubleTabbed)

    if (doubleTabbed) {
      config.set('poi.tabarea.vertical', vertical)
    }
  }

  render() {
    const {
      layout,
      reversed,
      isolateGameWindow,
      enableDoubleTabbed,
      verticalDoubleTabbed,
      overlayPanel,
      gridPanel,
      t,
    } = this.props
    const leftActive =
      !overlayPanel && !isolateGameWindow && !gridPanel && layout === 'horizontal' && reversed
    const downActive =
      !overlayPanel && !isolateGameWindow && !gridPanel && layout !== 'horizontal' && !reversed
    const upActive =
      !overlayPanel && !isolateGameWindow && !gridPanel && layout !== 'horizontal' && reversed
    const rightActive =
      !overlayPanel &&
      !isolateGameWindow &&
      !gridPanel &&
      layout === 'horizontal' &&
      !reversed &&
      !overlayPanel
    return (
      <Section title={t('Layout')}>
        <Wrapper>
          <Wrapper>
            <FormGroup inline>
              <ButtonGroup style={{ marginRight: '2em' }}>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={rightActive}
                  onClick={(e) => this.handleSetLayout('horizontal', false)}
                >
                  <Icon>{SVG.horizontal}</Icon>
                </Button>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={downActive}
                  onClick={(e) => this.handleSetLayout('vertical', false)}
                >
                  <Icon>{SVG.vertical}</Icon>
                </Button>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={upActive}
                  onClick={(e) => this.handleSetLayout('vertical', true)}
                >
                  <Icon invertY>{SVG.vertical}</Icon>
                </Button>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={leftActive}
                  onClick={(e) => this.handleSetLayout('horizontal', true)}
                >
                  <Icon invertX>{SVG.horizontal}</Icon>
                </Button>
              </ButtonGroup>

              <ButtonGroup>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={isolateGameWindow}
                  onClick={this.handleSetIsolateGameWindow}
                >
                  <Icon>{SVG.separate}</Icon>
                </Button>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={overlayPanel && !isolateGameWindow && !gridPanel}
                  onClick={(e) => this.handleSetOverlayPanel()}
                >
                  <Icon>{SVG.panel}</Icon>
                </Button>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={gridPanel && !isolateGameWindow && !overlayPanel}
                  onClick={(e) => this.handleSetGridPanel()}
                >
                  <Icon>{SVG.grid}</Icon>
                </Button>
              </ButtonGroup>
            </FormGroup>
          </Wrapper>

          <Wrapper>
            <FormGroup inline>
              <ButtonGroup>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={!enableDoubleTabbed && !gridPanel}
                  onClick={(e) => this.handleSetDoubleTabbed(false)}
                >
                  <Icon invertX>{SVG.singleTab}</Icon>
                </Button>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={enableDoubleTabbed && !verticalDoubleTabbed && !gridPanel}
                  onClick={(e) => this.handleSetDoubleTabbed(true, false)}
                >
                  <Icon>{SVG.doubleTabHorizontal}</Icon>
                </Button>
                <Button
                  minimal
                  intent={Intent.PRIMARY}
                  active={enableDoubleTabbed && verticalDoubleTabbed && !gridPanel}
                  onClick={(e) => this.handleSetDoubleTabbed(true, true)}
                >
                  <Icon invertY>{SVG.doubleTabVertical}</Icon>
                </Button>
              </ButtonGroup>
            </FormGroup>
          </Wrapper>
        </Wrapper>
      </Section>
    )
  }
}

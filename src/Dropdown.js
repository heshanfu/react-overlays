import matches from 'dom-helpers/query/matches'
import qsa from 'dom-helpers/query/querySelectorAll'
import React from 'react'
import PropTypes from 'prop-types'
import ReactDOM from 'react-dom'
import uncontrollable from 'uncontrollable'

import createPopper from './utils/createPopper'
import DropdownContext, {
  dropdownMenu,
  dropdownToggle,
} from './DropdownContext'

const propTypes = {
  /**
   * Determines the direction and location of the Menu in relation to it's Toggle.
   */
  drop: PropTypes.oneOf(['up', 'left', 'right', 'down']),

  /**
   * A css slector string that will return __focusable__ menu items.
   * Selectors should be relative to the menu component:
   * e.g. ` > li:not('.disabled')`
   */
  itemSelector: PropTypes.string.isRequired,
  /**
   * Align the menu to the right side of the Dropdown toggle
   */
  alignRight: PropTypes.bool,

  /**
   * Whether or not the Dropdown is visible.
   *
   * @controllable onToggle
   */
  show: PropTypes.bool,

  /**
   * Allow Dropdown to flip in case of an overlapping on the reference element. For more information refer to
   * Popper.js's flip [docs](https://popper.js.org/popper-documentation.html#modifiers..flip.enabled).
   *
   */
  flip: PropTypes.bool,

  /**
   * A callback fired when the Dropdown wishes to change visibility. Called with the requested
   * `show` value, the DOM event, and the source that fired it: `'click'`,`'keydown'`,`'rootClose'`, or `'select'`.
   *
   * ```js
   * function(
   *   isOpen: boolean,
   *   event: SyntheticEvent,
   * ): void
   * ```
   *
   * @controllable show
   */
  onToggle: PropTypes.func,
}

const defaultProps = {
  as: 'div',
}

class Dropdown extends React.Component {
  static getDerivedStateFromProps({ drop, alignRight, show }, prevState) {
    let placement = alignRight ? 'bottom-end' : 'bottom-start'
    if (drop === 'up') placement = alignRight ? 'top-end' : 'top-start'
    if (drop === 'right') placement = 'right-start'
    if (drop === 'left') placement = 'left-start'

    return {
      placement,
      lastShow: prevState.dropdownContext.show,
      dropdownContext: {
        ...prevState.dropdownContext,
        alignRight,
        show,
      },
    }
  }

  constructor(props, context) {
    super(props, context)

    this._focusInDropdown = false
    this.popper = createPopper(this.handleUpdate)

    this.state = {
      dropdownContext: {
        popper: {},
        onToggle: this.handleClick,
        onClose: this.handleClose,
        setToggleElement: el => {
          this.toggle = ReactDOM.findDOMNode(el)
          if (this.toggle)
            this.setState(({ dropdownContext }) => ({
              dropdownContext: {
                ...dropdownContext,
                toggleId: this.toggle.id,
              },
            }))
          if (this.props.show) this.updatePosition()
        },
        setMenuElement: el => {
          this.menu = ReactDOM.findDOMNode(el)
          if (this.props.show) this.updatePosition()
        },
      },
    }
  }

  componentDidMount() {
    if (this.props.show) this.updatePosition()
  }

  componentDidUpdate(prevProps) {
    const { show } = this.props
    const prevOpen = prevProps.show

    if (show && !prevOpen) {
      this.updatePosition()
      this.maybeFocusFirst()
    }
    if (!show && prevOpen) {
      // if focus hasn't already moved from the menu let's return it
      // to the toggle
      if (this._focusInDropdown) {
        this._focusInDropdown = false
        this.focus()
      }
    }
  }

  componentWillUnmount() {
    if (this.popper) this.popper.destroy()
  }

  getNextFocusedChild(current, offset) {
    if (!this.menu) return null

    const { itemSelector } = this.props
    let items = qsa(this.menu, itemSelector)

    let index = items.indexOf(current) + offset
    index = Math.max(0, Math.min(index, items.length))

    return items[index]
  }

  hasMenuRole() {
    return this.menu && matches(this.menu, '[role=menu]')
  }

  focus() {
    if (this.toggle && this.toggle.focus) {
      this.toggle.focus()
    }
  }

  maybeFocusFirst() {
    if (!this.hasMenuRole()) return

    const { itemSelector } = this.props
    let first = qsa(this.menu, itemSelector)[0]
    if (first && first.focus) first.focus()
  }
  handleClick = event => {
    this.toggleOpen(event)
  }

  handleKeyDown = event => {
    const { key, target } = event
    const isInput = /input|textarea/i.test(target.tagName)
    // Second only to https://github.com/twbs/bootstrap/blob/8cfbf6933b8a0146ac3fbc369f19e520bd1ebdac/js/src/dropdown.js#L400
    // in inscrutability
    if (
      isInput &&
      (key === ' ' || (key !== 'Escape' && this.menu.contains(target)))
    ) {
      return
    }

    switch (key) {
      case 'ArrowUp': {
        let next = this.getNextFocusedChild(target, -1)
        if (next && next.focus) next.focus()
        event.preventDefault()

        return
      }
      case 'ArrowDown':
        event.preventDefault()
        if (!this.props.show) {
          this.toggleOpen(event)
        } else {
          let next = this.getNextFocusedChild(target, 1)
          if (next && next.focus) next.focus()
        }
        return
      case 'Escape':
      case 'Tab':
        this.handleClose(event)
        break
      default:
    }
  }

  handleUpdate = popper => {
    this.setState({ popper })
  }

  updatePosition() {
    if (!this.toggle || !this.menu) return

    this.popper.update({
      element: this.menu,
      target: this.toggle,
      placement: this.state.placement,
      modifiers: {
        flip: { enabled: !!this.props.flip },
      },
    })
  }

  toggleOpen(event) {
    let show = !this.props.show
    this.props.onToggle(show, event)
  }

  render() {
    const { children, ...props } = this.props

    delete props.onToggle

    if (this.state.lastShow && !this.props.show) {
      this._focusInDropdown = this.menu.contains(document.activeElement)
    }
    const { dropdownContext, popper = {} } = this.state
    dropdownContext.popper = popper

    return (
      <DropdownContext.Provider value={dropdownContext}>
        {children({
          onKeyDown: this.handleKeyDown,
        })}
      </DropdownContext.Provider>
    )
  }
}

Dropdown.propTypes = propTypes
Dropdown.defaultProps = defaultProps

const UncontrolledDropdown = uncontrollable(Dropdown, { show: 'onToggle' })

export { dropdownMenu, dropdownToggle }
export default UncontrolledDropdown

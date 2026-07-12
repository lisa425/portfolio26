import { render } from '@testing-library/react'
import Corners from '../Corners'

describe('Corners', () => {
  it('4개 방향의 코너 span을 렌더한다', () => {
    const { container } = render(<Corners />)
    for (const pos of ['top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      expect(container.querySelector(`.corner.${pos}`)).toBeInTheDocument()
    }
    expect(container.querySelectorAll('.corner')).toHaveLength(4)
  })
})

import { fireEvent, render } from '@testing-library/react'
import type { SubProjectType } from '../../../types'
import WorksSubList from '../WorksSubList'

const items: SubProjectType[] = [
  {
    title: 'Project With Link',
    dept: 'NEXON',
    intro: 'intro text',
    date: '2025.01',
    stack: 'React',
    url: 'https://www.example.com/event/page',
  },
  {
    title: 'Project Without Link',
    dept: 'NEXON',
    intro: '',
    date: '2021.07 - 2021.10',
    stack: 'Vue.js',
  },
]

describe('WorksSubList', () => {
  it('항목 수만큼 행을 렌더한다', () => {
    const { container } = render(<WorksSubList items={items} />)
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('빈 배열이면 아무것도 렌더하지 않는다', () => {
    const { container } = render(<WorksSubList items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('YEAR 칸은 date의 연도(앞 4자리)만 보여준다 (기간형 date 포함)', () => {
    const { getByText } = render(<WorksSubList items={items} />)
    expect(getByText('2025')).toBeInTheDocument()
    expect(getByText('2021')).toBeInTheDocument()
  })

  it('url이 있는 항목만 외부 링크(새 탭)를 렌더한다', () => {
    const { container } = render(<WorksSubList items={items} />)
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', 'https://www.example.com/event/page')
    expect(links[0]).toHaveAttribute('target', '_blank')
    expect(links[0]).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('링크 라벨은 www를 뗀 호스트명이다', () => {
    const { container } = render(<WorksSubList items={items} />)
    expect(container.querySelector('a')?.textContent).toContain('example.com')
  })

  it('헤딩 텍스트를 바꿀 수 있다 (기본 OTHER PROJECTS)', () => {
    const { getByText, rerender } = render(<WorksSubList items={items} />)
    expect(getByText(/OTHER PROJECTS/)).toBeInTheDocument()
    rerender(
      <WorksSubList
        items={items}
        title="SUB PROJECTS"
      />,
    )
    expect(getByText(/SUB PROJECTS/)).toBeInTheDocument()
  })

  describe('onItemClick이 주어진 경우 (Selected Project 용도)', () => {
    it('행이 role=button/tabIndex를 갖고 LINK 칸은 [ ENTER ]로 대체된다', () => {
      const onItemClick = jest.fn()
      const { getAllByRole, queryAllByRole, getAllByText } = render(
        <WorksSubList
          items={items}
          onItemClick={onItemClick}
        />,
      )
      const rows = getAllByRole('button')
      expect(rows).toHaveLength(2)
      expect(rows[0]).toHaveAttribute('tabIndex', '0')
      expect(queryAllByRole('link')).toHaveLength(0)
      expect(getAllByText('[ ENTER ]')).toHaveLength(2)
    })

    it('클릭하면 해당 행의 인덱스와 함께 콜백이 호출된다', () => {
      const onItemClick = jest.fn()
      const { getAllByRole } = render(
        <WorksSubList
          items={items}
          onItemClick={onItemClick}
        />,
      )
      fireEvent.click(getAllByRole('button')[1])
      expect(onItemClick).toHaveBeenCalledWith(1)
    })

    it('Enter/Space 키로도 콜백이 호출된다', () => {
      const onItemClick = jest.fn()
      const { getAllByRole } = render(
        <WorksSubList
          items={items}
          onItemClick={onItemClick}
        />,
      )
      const [row] = getAllByRole('button')
      fireEvent.keyDown(row, { key: 'Enter' })
      fireEvent.keyDown(row, { key: ' ' })
      expect(onItemClick).toHaveBeenCalledTimes(2)
      expect(onItemClick).toHaveBeenNthCalledWith(1, 0)
      expect(onItemClick).toHaveBeenNthCalledWith(2, 0)
    })
  })
})
